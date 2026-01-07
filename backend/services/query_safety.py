"""
Query safety service.

Provides safeguards for database queries including:
- Query timeout enforcement
- Row limit enforcement
- Dangerous pattern detection
- Query complexity analysis
"""

import re
from typing import Any, Dict, List, Optional, Generator
from dataclasses import dataclass
from enum import Enum

from core.logging import get_logger
from config import settings

logger = get_logger(__name__)


class QueryRisk(str, Enum):
    """Risk levels for queries."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    BLOCKED = "blocked"


@dataclass
class QueryAnalysis:
    """Result of query safety analysis."""
    risk_level: QueryRisk
    issues: List[str]
    recommendations: List[str]
    estimated_complexity: str  # "simple", "moderate", "complex"
    has_limit: bool
    has_where: bool
    tables_accessed: List[str]
    is_safe: bool


class QuerySafetyConfig:
    """Configuration for query safety checks."""

    def __init__(
        self,
        max_timeout_seconds: int = 300,
        default_timeout_seconds: int = 60,
        max_row_limit: int = 100000,
        default_row_limit: int = 10000,
        allow_unlimited: bool = False,
        blocked_patterns: Optional[List[str]] = None,
        warn_patterns: Optional[List[str]] = None
    ):
        self.max_timeout_seconds = max_timeout_seconds
        self.default_timeout_seconds = default_timeout_seconds
        self.max_row_limit = max_row_limit
        self.default_row_limit = default_row_limit
        self.allow_unlimited = allow_unlimited

        # Patterns that should block query execution
        self.blocked_patterns = blocked_patterns or [
            r'\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX)\b',
            r'\bTRUNCATE\s+TABLE\b',
            r'\bDELETE\s+FROM\s+\w+\s*$',  # DELETE without WHERE
            r'\bALTER\s+(TABLE|DATABASE)\b',
            r'\bCREATE\s+(TABLE|DATABASE|INDEX)\b',
            r'\bGRANT\b',
            r'\bREVOKE\b',
            r';\s*--',  # SQL injection attempt
            r"'\s*OR\s*'1'\s*=\s*'1",  # SQL injection
            r'UNION\s+ALL\s+SELECT',  # Potential injection
        ]

        # Patterns that trigger warnings
        self.warn_patterns = warn_patterns or [
            r'SELECT\s+\*',  # SELECT * is inefficient
            r'\bCROSS\s+JOIN\b',  # Can be expensive
            r'(?<!NOT\s)\bLIKE\s+[\'"]%',  # Leading wildcard LIKE
            r'\bOR\s+1\s*=\s*1\b',  # Always-true condition
            r'(?i)information_schema',  # Metadata access
            r'(?i)pg_catalog',  # PostgreSQL system tables
        ]


# Global default configuration
_default_config = QuerySafetyConfig()


def get_default_config() -> QuerySafetyConfig:
    """Get the default query safety configuration."""
    return _default_config


class QuerySafetyService:
    """Service for analyzing and enforcing query safety."""

    def __init__(self, config: Optional[QuerySafetyConfig] = None):
        self.config = config or _default_config

    def analyze_query(self, query: str) -> QueryAnalysis:
        """
        Analyze a SQL query for safety issues.

        Args:
            query: SQL query string

        Returns:
            QueryAnalysis with risk assessment and recommendations
        """
        query_upper = query.upper()
        issues = []
        recommendations = []
        risk_level = QueryRisk.LOW

        # Check for blocked patterns
        for pattern in self.config.blocked_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                issues.append(f"Blocked pattern detected: {pattern[:30]}...")
                risk_level = QueryRisk.BLOCKED

        # Check for warning patterns
        for pattern in self.config.warn_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                issues.append(f"Warning pattern: {pattern[:30]}...")
                if risk_level != QueryRisk.BLOCKED:
                    risk_level = QueryRisk.MEDIUM

        # Check for LIMIT clause
        has_limit = bool(re.search(r'\bLIMIT\s+\d+', query_upper))
        if not has_limit and "SELECT" in query_upper:
            issues.append("No LIMIT clause - query may return excessive rows")
            recommendations.append(f"Add LIMIT {self.config.default_row_limit}")
            if risk_level == QueryRisk.LOW:
                risk_level = QueryRisk.MEDIUM

        # Check for WHERE clause
        has_where = bool(re.search(r'\bWHERE\b', query_upper))
        if not has_where and "SELECT" in query_upper:
            issues.append("No WHERE clause - full table scan likely")
            recommendations.append("Add WHERE clause to filter results")
            if risk_level == QueryRisk.LOW:
                risk_level = QueryRisk.MEDIUM

        # Extract tables accessed
        tables = self._extract_tables(query)

        # Estimate complexity
        complexity = self._estimate_complexity(query)
        if complexity == "complex" and risk_level == QueryRisk.LOW:
            risk_level = QueryRisk.MEDIUM

        return QueryAnalysis(
            risk_level=risk_level,
            issues=issues,
            recommendations=recommendations,
            estimated_complexity=complexity,
            has_limit=has_limit,
            has_where=has_where,
            tables_accessed=tables,
            is_safe=risk_level != QueryRisk.BLOCKED
        )

    def enforce_safety(
        self,
        query: str,
        timeout: Optional[int] = None,
        row_limit: Optional[int] = None
    ) -> tuple[str, int]:
        """
        Enforce safety measures on a query.

        Args:
            query: Original SQL query
            timeout: Requested timeout (will be capped)
            row_limit: Requested row limit (will be capped)

        Returns:
            Tuple of (modified_query, effective_timeout)

        Raises:
            ValueError: If query contains blocked patterns
        """
        # Analyze query first
        analysis = self.analyze_query(query)

        if not analysis.is_safe:
            logger.warning(
                "query_blocked",
                issues=analysis.issues,
                query_preview=query[:100]
            )
            raise ValueError(f"Query blocked for safety: {', '.join(analysis.issues)}")

        # Cap timeout
        effective_timeout = min(
            timeout or self.config.default_timeout_seconds,
            self.config.max_timeout_seconds
        )

        # Enforce row limit
        effective_limit = min(
            row_limit or self.config.default_row_limit,
            self.config.max_row_limit
        )

        modified_query = query

        # Add or modify LIMIT if not present
        if not analysis.has_limit and not self.config.allow_unlimited:
            # Remove trailing semicolon if present
            modified_query = modified_query.rstrip().rstrip(';')
            modified_query = f"{modified_query} LIMIT {effective_limit}"

        if analysis.issues:
            logger.info(
                "query_safety_warnings",
                issues=analysis.issues,
                timeout=effective_timeout,
                row_limit=effective_limit
            )

        return modified_query, effective_timeout

    def _extract_tables(self, query: str) -> List[str]:
        """Extract table names from a query."""
        tables = []

        # Match FROM and JOIN clauses
        patterns = [
            r'\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)',
            r'\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)',
        ]

        for pattern in patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            tables.extend(matches)

        return list(set(tables))

    def _estimate_complexity(self, query: str) -> str:
        """Estimate query complexity based on structure."""
        query_upper = query.upper()
        score = 0

        # Join count
        join_count = len(re.findall(r'\bJOIN\b', query_upper))
        score += join_count * 2

        # Subquery count
        subquery_count = query_upper.count('SELECT') - 1
        score += subquery_count * 3

        # Aggregation
        if re.search(r'\b(GROUP BY|HAVING|DISTINCT)\b', query_upper):
            score += 2

        # Window functions
        if re.search(r'\bOVER\s*\(', query_upper):
            score += 3

        # CTEs
        if 'WITH' in query_upper and 'AS' in query_upper:
            score += 2

        if score <= 2:
            return "simple"
        elif score <= 6:
            return "moderate"
        else:
            return "complex"


def stream_large_result(
    result_iterator: Any,
    chunk_size: int = 1000
) -> Generator[List[Dict], None, None]:
    """
    Stream large query results in chunks.

    Args:
        result_iterator: SQLAlchemy result iterator
        chunk_size: Number of rows per chunk

    Yields:
        Lists of row dictionaries
    """
    chunk = []
    for row in result_iterator:
        chunk.append(dict(row._mapping) if hasattr(row, '_mapping') else row)
        if len(chunk) >= chunk_size:
            yield chunk
            chunk = []

    if chunk:
        yield chunk


# Convenience instance
query_safety = QuerySafetyService()


def analyze_query(query: str) -> QueryAnalysis:
    """Analyze a query using the default service."""
    return query_safety.analyze_query(query)


def enforce_safety(
    query: str,
    timeout: Optional[int] = None,
    row_limit: Optional[int] = None
) -> tuple[str, int]:
    """Enforce safety on a query using the default service."""
    return query_safety.enforce_safety(query, timeout, row_limit)
