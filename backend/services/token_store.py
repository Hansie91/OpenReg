"""
Redis-backed token store for JWT token lifecycle management.

Provides:
- Token registration on login
- Token revocation on logout
- Bulk revocation (logout all sessions)
- Token validity checking for revocation detection
"""

from datetime import datetime, timedelta
from typing import Optional
import redis
import logging

from config import settings

logger = logging.getLogger(__name__)


class TokenStore:
    """
    Redis-backed store for tracking active JWT tokens.

    Token keys follow the pattern: token:{user_id}:{token_type}:{jti}
    This allows for:
    - Individual token revocation
    - Revoking all tokens for a user
    - Revoking all access or refresh tokens for a user
    """

    def __init__(self, redis_url: str = None):
        """
        Initialize the token store.

        Args:
            redis_url: Redis connection URL. Defaults to settings.REDIS_URL
        """
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis: Optional[redis.Redis] = None
        self._connected = False

    @property
    def redis(self) -> Optional[redis.Redis]:
        """Lazy Redis connection with auto-reconnect."""
        if self._redis is None or not self._connected:
            try:
                self._redis = redis.from_url(
                    self.redis_url,
                    decode_responses=True,
                    socket_timeout=5,
                    socket_connect_timeout=5
                )
                self._redis.ping()
                self._connected = True
            except redis.RedisError as e:
                logger.warning(f"Could not connect to Redis: {e}")
                self._connected = False
                return None
        return self._redis

    def _get_token_key(self, user_id: str, jti: str, token_type: str) -> str:
        """Generate the Redis key for a token."""
        return f"token:{user_id}:{token_type}:{jti}"

    def _get_user_pattern(self, user_id: str, token_type: str = "*") -> str:
        """Generate a pattern for matching user tokens."""
        return f"token:{user_id}:{token_type}:*"

    def register_token(
        self,
        user_id: str,
        jti: str,
        token_type: str,
        expires_at: datetime,
        metadata: dict = None
    ) -> bool:
        """
        Register a token as active.

        Args:
            user_id: The user ID (from token 'sub' claim)
            jti: JWT ID (unique token identifier)
            token_type: 'access' or 'refresh'
            expires_at: When the token expires
            metadata: Optional metadata (IP, user agent, etc.)

        Returns:
            True if registered successfully, False otherwise
        """
        if not self.redis:
            logger.debug("Redis not available, skipping token registration")
            return False

        try:
            key = self._get_token_key(user_id, jti, token_type)
            ttl = int((expires_at - datetime.utcnow()).total_seconds())

            if ttl <= 0:
                return False

            value = "active"
            if metadata:
                import json
                value = json.dumps({"status": "active", **metadata})

            self.redis.setex(key, ttl, value)
            logger.debug(f"Registered {token_type} token for user {user_id}")
            return True

        except redis.RedisError as e:
            logger.warning(f"Failed to register token: {e}")
            return False

    def revoke_token(self, user_id: str, jti: str, token_type: str) -> bool:
        """
        Revoke a specific token.

        Args:
            user_id: The user ID
            jti: JWT ID
            token_type: 'access' or 'refresh'

        Returns:
            True if revoked, False otherwise
        """
        if not self.redis:
            return False

        try:
            key = self._get_token_key(user_id, jti, token_type)
            result = self.redis.delete(key)
            if result:
                logger.info(f"Revoked {token_type} token for user {user_id}")
            return result > 0

        except redis.RedisError as e:
            logger.warning(f"Failed to revoke token: {e}")
            return False

    def revoke_all_user_tokens(self, user_id: str, token_type: str = None) -> int:
        """
        Revoke all tokens for a user.

        Args:
            user_id: The user ID
            token_type: Optional - 'access', 'refresh', or None for all types

        Returns:
            Number of tokens revoked
        """
        if not self.redis:
            return 0

        try:
            pattern = self._get_user_pattern(user_id, token_type or "*")
            keys = list(self.redis.scan_iter(pattern))

            if not keys:
                return 0

            count = self.redis.delete(*keys)
            logger.info(f"Revoked {count} tokens for user {user_id}")
            return count

        except redis.RedisError as e:
            logger.warning(f"Failed to revoke user tokens: {e}")
            return 0

    def is_token_valid(self, user_id: str, jti: str, token_type: str) -> bool:
        """
        Check if a token is still valid (not revoked).

        Args:
            user_id: The user ID
            jti: JWT ID
            token_type: 'access' or 'refresh'

        Returns:
            True if token exists and is valid, False if revoked or unknown
        """
        if not self.redis:
            # If Redis is unavailable, assume tokens are valid
            # This is a graceful degradation - log and continue
            return True

        try:
            key = self._get_token_key(user_id, jti, token_type)
            return self.redis.exists(key) > 0

        except redis.RedisError as e:
            logger.warning(f"Failed to check token validity: {e}")
            # Fail open - if Redis is down, accept the token
            return True

    def is_token_valid_sync(self, user_id: str, jti: str, token_type: str) -> bool:
        """
        Synchronous wrapper for is_token_valid.
        Used by the get_current_user dependency.
        """
        return self.is_token_valid(user_id, jti, token_type)

    def get_user_sessions(self, user_id: str) -> list:
        """
        Get all active sessions (refresh tokens) for a user.

        Args:
            user_id: The user ID

        Returns:
            List of session metadata dicts
        """
        if not self.redis:
            return []

        try:
            import json
            pattern = self._get_user_pattern(user_id, "refresh")
            sessions = []

            for key in self.redis.scan_iter(pattern):
                value = self.redis.get(key)
                ttl = self.redis.ttl(key)
                jti = key.split(":")[-1]

                session = {
                    "jti": jti,
                    "expires_in_seconds": ttl
                }

                if value and value != "active":
                    try:
                        metadata = json.loads(value)
                        session.update(metadata)
                    except json.JSONDecodeError:
                        pass

                sessions.append(session)

            return sessions

        except redis.RedisError as e:
            logger.warning(f"Failed to get user sessions: {e}")
            return []

    def extend_token(self, user_id: str, jti: str, token_type: str, new_expires_at: datetime) -> bool:
        """
        Extend a token's expiration time (for sliding sessions).

        Args:
            user_id: The user ID
            jti: JWT ID
            token_type: 'access' or 'refresh'
            new_expires_at: New expiration time

        Returns:
            True if extended, False otherwise
        """
        if not self.redis:
            return False

        try:
            key = self._get_token_key(user_id, jti, token_type)
            ttl = int((new_expires_at - datetime.utcnow()).total_seconds())

            if ttl <= 0:
                return False

            if not self.redis.exists(key):
                return False

            self.redis.expire(key, ttl)
            return True

        except redis.RedisError as e:
            logger.warning(f"Failed to extend token: {e}")
            return False

    def close(self):
        """Close the Redis connection."""
        if self._redis:
            self._redis.close()
            self._redis = None
            self._connected = False


# Global token store instance
# Initialized lazily when first accessed
_token_store: Optional[TokenStore] = None


def get_token_store() -> TokenStore:
    """Get or create the global token store instance."""
    global _token_store
    if _token_store is None:
        _token_store = TokenStore()
    return _token_store


# Convenience alias for import
token_store = get_token_store()
