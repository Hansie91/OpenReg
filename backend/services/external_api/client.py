"""
External Regulatory API HTTP Client

Async HTTP client for communicating with external regulatory data APIs.
Features:
- Multiple authentication types (API key, OAuth2, Basic)
- Exponential backoff retry logic
- Rate limiting
- Response caching via Redis
"""

import httpx
import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum

import redis
from config import settings
from services.auth import decrypt_credentials

logger = logging.getLogger(__name__)


class AuthType(str, Enum):
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    BASIC = "basic"


@dataclass
class ExternalAPIResponse:
    """Response from external regulatory API"""
    reports: List[Dict[str, Any]]
    validation_rules: List[Dict[str, Any]]
    reference_data: List[Dict[str, Any]]
    schedules: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    raw_response: Dict[str, Any]


@dataclass
class FetchResult:
    """Result of a fetch operation"""
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    response_time_ms: int = 0


class RateLimiter:
    """Simple token bucket rate limiter using Redis"""

    def __init__(self, redis_client: redis.Redis, key_prefix: str, limit_per_minute: int):
        self.redis = redis_client
        self.key_prefix = key_prefix
        self.limit = limit_per_minute
        self.window = 60  # seconds

    async def acquire(self) -> bool:
        """Acquire a token. Returns True if allowed, False if rate limited."""
        key = f"{self.key_prefix}:ratelimit"
        current = self.redis.get(key)

        if current is None:
            self.redis.setex(key, self.window, 1)
            return True

        if int(current) >= self.limit:
            return False

        self.redis.incr(key)
        return True

    async def wait_if_needed(self):
        """Wait until a token is available"""
        while not await self.acquire():
            await asyncio.sleep(1)


class ResponseCache:
    """Redis-backed response cache"""

    def __init__(self, redis_client: redis.Redis, ttl_seconds: int = 3600):
        self.redis = redis_client
        self.ttl = ttl_seconds

    def _cache_key(self, url: str, params: Optional[Dict] = None) -> str:
        """Generate cache key from URL and params"""
        key_data = f"{url}:{json.dumps(params or {}, sort_keys=True)}"
        return f"external_api_cache:{hashlib.sha256(key_data.encode()).hexdigest()}"

    def get(self, url: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Get cached response"""
        key = self._cache_key(url, params)
        data = self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    def set(self, url: str, params: Optional[Dict], data: Dict):
        """Cache response"""
        key = self._cache_key(url, params)
        self.redis.setex(key, self.ttl, json.dumps(data))

    def invalidate(self, url: str, params: Optional[Dict] = None):
        """Invalidate cached response"""
        key = self._cache_key(url, params)
        self.redis.delete(key)


class ExternalRegulatoryAPIClient:
    """
    Async HTTP client for external regulatory data APIs.

    Supports multiple authentication methods, automatic retry with
    exponential backoff, rate limiting, and response caching.
    """

    def __init__(
        self,
        api_base_url: str,
        auth_type: AuthType,
        encrypted_credentials: bytes,
        api_version: Optional[str] = None,
        rate_limit_per_minute: int = 60,
        retry_config: Optional[Dict] = None,
        cache_ttl_seconds: int = 3600,
        schema_mapping: Optional[Dict] = None,
    ):
        self.api_base_url = api_base_url.rstrip('/')
        self.api_version = api_version
        self.auth_type = AuthType(auth_type) if isinstance(auth_type, str) else auth_type
        self.credentials = self._decrypt_credentials(encrypted_credentials)

        # Retry configuration
        self.retry_config = retry_config or {
            "max_retries": 3,
            "backoff": "exponential",
            "base_delay": 2,
            "max_delay": 60
        }

        # Schema mapping for flexible response parsing
        self.schema_mapping = schema_mapping or {
            "reports_path": "reports",
            "validations_path": "validation_rules",
            "reference_data_path": "reference_data",
            "schedules_path": "schedules",
            "external_id_field": "external_id",
            "version_field": "version",
            "metadata_path": "metadata"
        }

        # Initialize Redis-based rate limiter and cache
        self._redis = redis.from_url(settings.REDIS_URL)
        self._rate_limiter = RateLimiter(
            self._redis,
            f"external_api:{hashlib.md5(api_base_url.encode()).hexdigest()[:8]}",
            rate_limit_per_minute
        )
        self._cache = ResponseCache(self._redis, cache_ttl_seconds)

    def _decrypt_credentials(self, encrypted_credentials: bytes) -> Dict[str, str]:
        """Decrypt API credentials"""
        if not encrypted_credentials:
            return {}
        try:
            decrypted = decrypt_credentials(encrypted_credentials)
            return json.loads(decrypted) if isinstance(decrypted, str) else decrypted
        except Exception as e:
            logger.error(f"Failed to decrypt credentials: {e}")
            return {}

    def _get_auth_headers(self) -> Dict[str, str]:
        """Build authentication headers based on auth type"""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        if self.api_version:
            headers["X-API-Version"] = self.api_version

        if self.auth_type == AuthType.API_KEY:
            api_key = self.credentials.get("api_key", "")
            header_name = self.credentials.get("header_name", "X-API-Key")
            headers[header_name] = api_key

        elif self.auth_type == AuthType.BASIC:
            import base64
            username = self.credentials.get("username", "")
            password = self.credentials.get("password", "")
            credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
            headers["Authorization"] = f"Basic {credentials}"

        elif self.auth_type == AuthType.OAUTH2:
            access_token = self.credentials.get("access_token", "")
            headers["Authorization"] = f"Bearer {access_token}"

        return headers

    def _calculate_retry_delay(self, attempt: int) -> float:
        """Calculate delay before next retry"""
        backoff = self.retry_config.get("backoff", "exponential")
        base_delay = self.retry_config.get("base_delay", 2)
        max_delay = self.retry_config.get("max_delay", 60)

        if backoff == "exponential":
            delay = min(base_delay * (2 ** attempt), max_delay)
        elif backoff == "linear":
            delay = min(base_delay * (attempt + 1), max_delay)
        else:  # fixed
            delay = base_delay

        return delay

    def _extract_path(self, data: Dict, path: str) -> Any:
        """Extract nested value using dot notation path"""
        if not path:
            return data

        parts = path.split('.')
        result = data
        for part in parts:
            if isinstance(result, dict):
                result = result.get(part)
            elif isinstance(result, list) and part.isdigit():
                result = result[int(part)] if int(part) < len(result) else None
            else:
                return None
            if result is None:
                return None
        return result

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        data: Optional[Dict] = None,
        use_cache: bool = True,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """Make HTTP request with retry logic and rate limiting"""
        url = f"{self.api_base_url}/{endpoint.lstrip('/')}"

        # Check cache for GET requests
        if method == "GET" and use_cache:
            cached = self._cache.get(url, params)
            if cached:
                logger.debug(f"Cache hit for {url}")
                return cached

        # Rate limiting
        await self._rate_limiter.wait_if_needed()

        headers = self._get_auth_headers()
        max_retries = self.retry_config.get("max_retries", 3)

        for attempt in range(max_retries + 1):
            try:
                start_time = datetime.utcnow()

                async with httpx.AsyncClient() as client:
                    if method == "GET":
                        response = await client.get(
                            url,
                            params=params,
                            headers=headers,
                            timeout=timeout
                        )
                    elif method == "POST":
                        response = await client.post(
                            url,
                            params=params,
                            json=data,
                            headers=headers,
                            timeout=timeout
                        )
                    else:
                        raise ValueError(f"Unsupported HTTP method: {method}")

                response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                # Handle rate limit responses
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(f"Rate limited, waiting {retry_after}s")
                    await asyncio.sleep(retry_after)
                    continue

                response.raise_for_status()
                result = response.json()

                # Cache successful GET responses
                if method == "GET" and use_cache:
                    self._cache.set(url, params, result)

                return result

            except httpx.HTTPStatusError as e:
                logger.warning(f"HTTP error {e.response.status_code} on attempt {attempt + 1}/{max_retries + 1}")
                if attempt < max_retries and e.response.status_code in [500, 502, 503, 504]:
                    delay = self._calculate_retry_delay(attempt)
                    logger.info(f"Retrying in {delay}s...")
                    await asyncio.sleep(delay)
                else:
                    raise

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                logger.warning(f"Connection error on attempt {attempt + 1}/{max_retries + 1}: {e}")
                if attempt < max_retries:
                    delay = self._calculate_retry_delay(attempt)
                    logger.info(f"Retrying in {delay}s...")
                    await asyncio.sleep(delay)
                else:
                    raise

        raise Exception(f"Max retries ({max_retries}) exceeded")

    async def test_connection(self) -> Dict[str, Any]:
        """Test API connection and credentials"""
        try:
            start_time = datetime.utcnow()

            # Try to fetch a small amount of data to test connection
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.api_base_url}/health",
                    headers=self._get_auth_headers(),
                    timeout=10
                )

            response_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Connection successful",
                    "response_time_ms": response_time_ms,
                    "api_version": response.headers.get("X-API-Version"),
                }
            elif response.status_code == 401:
                return {
                    "success": False,
                    "message": "Authentication failed - check credentials",
                    "response_time_ms": response_time_ms,
                }
            elif response.status_code == 403:
                return {
                    "success": False,
                    "message": "Access forbidden - check permissions",
                    "response_time_ms": response_time_ms,
                }
            else:
                return {
                    "success": False,
                    "message": f"Unexpected response: {response.status_code}",
                    "response_time_ms": response_time_ms,
                }

        except httpx.ConnectError as e:
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}",
            }
        except httpx.TimeoutException:
            return {
                "success": False,
                "message": "Connection timeout",
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error: {str(e)}",
            }

    async def fetch_all(
        self,
        since: Optional[datetime] = None,
        use_cache: bool = False
    ) -> ExternalAPIResponse:
        """
        Fetch all regulatory data (reports, validations, reference data, schedules).

        Args:
            since: Only fetch items modified since this datetime (for differential sync)
            use_cache: Whether to use cached responses

        Returns:
            ExternalAPIResponse with all fetched data
        """
        params = {}
        if since:
            params["modified_since"] = since.isoformat()

        try:
            # Try fetching all data in one request if API supports it
            response = await self._make_request(
                "GET",
                "/regulatory-data",
                params=params,
                use_cache=use_cache
            )

            return ExternalAPIResponse(
                reports=self._extract_path(response, self.schema_mapping["reports_path"]) or [],
                validation_rules=self._extract_path(response, self.schema_mapping["validations_path"]) or [],
                reference_data=self._extract_path(response, self.schema_mapping["reference_data_path"]) or [],
                schedules=self._extract_path(response, self.schema_mapping["schedules_path"]) or [],
                metadata=self._extract_path(response, self.schema_mapping["metadata_path"]) or {},
                raw_response=response
            )

        except Exception as e:
            logger.warning(f"Failed to fetch all data in one request: {e}")
            # Fall back to fetching each type separately
            reports = await self.fetch_reports(since, use_cache)
            validations = await self.fetch_validations(since, use_cache)
            reference_data = await self.fetch_reference_data(since, use_cache)
            schedules = await self.fetch_schedules(since, use_cache)

            return ExternalAPIResponse(
                reports=reports.data or [],
                validation_rules=validations.data or [],
                reference_data=reference_data.data or [],
                schedules=schedules.data or [],
                metadata={},
                raw_response={}
            )

    async def fetch_reports(
        self,
        since: Optional[datetime] = None,
        use_cache: bool = False
    ) -> FetchResult:
        """Fetch report definitions from external API"""
        params = {}
        if since:
            params["modified_since"] = since.isoformat()

        try:
            start_time = datetime.utcnow()
            response = await self._make_request(
                "GET",
                "/reports",
                params=params,
                use_cache=use_cache
            )
            response_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            data = self._extract_path(response, self.schema_mapping["reports_path"])
            if data is None:
                data = response if isinstance(response, list) else response.get("data", [])

            return FetchResult(
                success=True,
                data=data,
                response_time_ms=response_time
            )

        except Exception as e:
            logger.error(f"Failed to fetch reports: {e}")
            return FetchResult(
                success=False,
                error=str(e)
            )

    async def fetch_validations(
        self,
        since: Optional[datetime] = None,
        use_cache: bool = False
    ) -> FetchResult:
        """Fetch validation rules from external API"""
        params = {}
        if since:
            params["modified_since"] = since.isoformat()

        try:
            start_time = datetime.utcnow()
            response = await self._make_request(
                "GET",
                "/validation-rules",
                params=params,
                use_cache=use_cache
            )
            response_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            data = self._extract_path(response, self.schema_mapping["validations_path"])
            if data is None:
                data = response if isinstance(response, list) else response.get("data", [])

            return FetchResult(
                success=True,
                data=data,
                response_time_ms=response_time
            )

        except Exception as e:
            logger.error(f"Failed to fetch validations: {e}")
            return FetchResult(
                success=False,
                error=str(e)
            )

    async def fetch_reference_data(
        self,
        since: Optional[datetime] = None,
        use_cache: bool = False
    ) -> FetchResult:
        """Fetch reference data (mapping sets) from external API"""
        params = {}
        if since:
            params["modified_since"] = since.isoformat()

        try:
            start_time = datetime.utcnow()
            response = await self._make_request(
                "GET",
                "/reference-data",
                params=params,
                use_cache=use_cache
            )
            response_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            data = self._extract_path(response, self.schema_mapping["reference_data_path"])
            if data is None:
                data = response if isinstance(response, list) else response.get("data", [])

            return FetchResult(
                success=True,
                data=data,
                response_time_ms=response_time
            )

        except Exception as e:
            logger.error(f"Failed to fetch reference data: {e}")
            return FetchResult(
                success=False,
                error=str(e)
            )

    async def fetch_schedules(
        self,
        since: Optional[datetime] = None,
        use_cache: bool = False
    ) -> FetchResult:
        """Fetch schedule definitions from external API"""
        params = {}
        if since:
            params["modified_since"] = since.isoformat()

        try:
            start_time = datetime.utcnow()
            response = await self._make_request(
                "GET",
                "/schedules",
                params=params,
                use_cache=use_cache
            )
            response_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            data = self._extract_path(response, self.schema_mapping["schedules_path"])
            if data is None:
                data = response if isinstance(response, list) else response.get("data", [])

            return FetchResult(
                success=True,
                data=data,
                response_time_ms=response_time
            )

        except Exception as e:
            logger.error(f"Failed to fetch schedules: {e}")
            return FetchResult(
                success=False,
                error=str(e)
            )

    def invalidate_cache(self):
        """Invalidate all cached responses for this API"""
        pattern = f"external_api_cache:*"
        keys = self._redis.keys(pattern)
        if keys:
            self._redis.delete(*keys)
            logger.info(f"Invalidated {len(keys)} cached responses")
