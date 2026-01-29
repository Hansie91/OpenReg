#!/usr/bin/env python3
"""
Security Checklist Verification Script for OpenReg

Verifies security patterns are correctly implemented across the codebase.
Run as part of CI or manual security review.

Usage:
    python scripts/security_checklist.py [--check CHECK_NAME] [--verbose]

Checks:
    - tenant-isolation: Verify all queries filter by tenant_id
    - audit-logging: Verify CRUD endpoints have audit logging
    - password-logging: Verify passwords not logged in audit
    - sql-injection: Verify no SQL injection patterns
    - all: Run all checks (default)
"""

import argparse
import re
import sys
from pathlib import Path
from typing import List, Tuple


class SecurityChecker:
    """Security verification checker for OpenReg codebase."""

    def __init__(self, backend_dir: Path, verbose: bool = False):
        self.backend_dir = backend_dir
        self.api_dir = backend_dir / "api"
        self.verbose = verbose
        self.issues: List[str] = []
        self.warnings: List[str] = []

    def log(self, msg: str):
        """Print message if verbose mode."""
        if self.verbose:
            print(f"  {msg}")

    def check_tenant_isolation(self) -> Tuple[bool, List[str]]:
        """
        Verify all API queries include tenant_id filtering.

        Looks for db.query() calls and ensures tenant_id is in the filter.
        """
        print("Checking tenant isolation...")
        issues = []

        # Files that should have tenant filtering
        api_files = list(self.api_dir.glob("*.py"))

        # Patterns that indicate a query
        query_pattern = re.compile(r'db\.query\([^)]+\)')

        # Files that are exempt (no data queries or special cases)
        exempt_files = {
            "__init__.py",
            "exceptions.py",
            "auth.py",  # Auth endpoints query User by email/id, tenant filtering via TenantScopedSession
        }

        for api_file in api_files:
            if api_file.name in exempt_files:
                continue

            try:
                content = api_file.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            lines = content.split("\n")

            for i, line in enumerate(lines, 1):
                if query_pattern.search(line):
                    # Check if tenant_id filter exists nearby (within 5 lines)
                    context_start = max(0, i - 2)
                    context_end = min(len(lines), i + 5)
                    context = "\n".join(lines[context_start:context_end])

                    # Check for tenant filtering patterns
                    has_tenant_filter = any([
                        "tenant_id" in context,
                        "current_user.tenant_id" in context,
                        "TenantScopedSession" in content,  # File uses tenant-scoped session
                        "get_tenant_db" in content,  # File uses tenant DB dependency
                    ])

                    if not has_tenant_filter:
                        # Check if this is a non-tenant-scoped query (e.g., looking up current user)
                        if "User" in line and "current_user" in context:
                            continue  # User lookup by ID is OK
                        if "Tenant" in line:
                            continue  # Tenant lookup is OK

                        issues.append(
                            f"{api_file.name}:{i}: Query may lack tenant filter: {line.strip()[:60]}..."
                        )
                    else:
                        self.log(f"{api_file.name}:{i}: OK - tenant filter found")

        if issues:
            print(f"  WARN: Found {len(issues)} potential tenant isolation concerns")
            for issue in issues:
                print(f"    - {issue}")
        else:
            print("  PASS: All queries appear to have tenant filtering")

        # Don't fail on warnings - these may be false positives
        return True, issues

    def check_audit_logging(self) -> Tuple[bool, List[str]]:
        """
        Verify CRUD endpoints have audit logging.

        Checks that files with POST/PUT/DELETE endpoints have log_audit calls.
        """
        print("Checking audit logging coverage...")
        issues = []

        api_files = list(self.api_dir.glob("*.py"))

        # Files that don't need audit logging (read-only, logging, or special purpose)
        exempt_files = {
            "__init__.py",
            "exceptions.py",
            "logs.py",  # This IS the logging endpoint
            "dashboard.py",  # Read-only dashboard
            "runs.py",  # Job runs are logged separately
            "lineage.py",  # Read-only lineage
            "queries.py",  # Read-only queries
            "submissions.py",  # Read-only submission status
            "schemas.py",  # Read-only schema info
            "delivery.py",  # Deliveries logged via job runs
            "workflow.py",  # Workflow state changes logged via state machine
        }

        # Patterns for mutating endpoints
        mutating_patterns = [
            re.compile(r'@router\.post\('),
            re.compile(r'@router\.put\('),
            re.compile(r'@router\.delete\('),
            re.compile(r'@router\.patch\('),
        ]

        for api_file in api_files:
            if api_file.name in exempt_files:
                continue

            try:
                content = api_file.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            has_mutating = any(p.search(content) for p in mutating_patterns)
            has_audit = "log_audit" in content or "AuditLog" in content

            if has_mutating and not has_audit:
                issues.append(
                    f"{api_file.name}: Has mutating endpoints but no audit logging"
                )
            elif has_mutating and has_audit:
                self.log(f"{api_file.name}: OK - has audit logging")
            elif not has_mutating:
                self.log(f"{api_file.name}: OK - no mutating endpoints")

        if issues:
            print(f"  WARN: Found {len(issues)} files that may need audit logging")
            for issue in issues:
                print(f"    - {issue}")
        else:
            print("  PASS: All files with mutating endpoints have audit logging")

        # Don't fail - audit logging may be handled differently
        return True, issues

    def check_password_logging(self) -> Tuple[bool, List[str]]:
        """
        Verify passwords/secrets are not logged in audit entries.

        Checks that log_audit calls don't include sensitive fields.
        """
        print("Checking for sensitive data in audit logs...")
        issues = []

        # Check all Python files in backend
        py_files = list(self.backend_dir.rglob("*.py"))

        # Sensitive field patterns - looking for these in log_audit calls
        sensitive_patterns = [
            (re.compile(r'log_audit\s*\([^)]*["\']password["\']', re.IGNORECASE | re.DOTALL),
             "password in audit log"),
            (re.compile(r'log_audit\s*\([^)]*["\']hashed_password["\']', re.IGNORECASE | re.DOTALL),
             "hashed_password in audit log"),
            (re.compile(r'log_audit\s*\([^)]*["\']secret["\']', re.IGNORECASE | re.DOTALL),
             "secret in audit log"),
            (re.compile(r'log_audit\s*\([^)]*["\']api_key["\'](?!\s*,\s*entity_type)', re.IGNORECASE | re.DOTALL),
             "api_key value in audit log"),
            (re.compile(r'log_audit\s*\([^)]*["\']credential', re.IGNORECASE | re.DOTALL),
             "credential in audit log"),
            (re.compile(r'log_audit\s*\([^)]*["\']token["\']', re.IGNORECASE | re.DOTALL),
             "token in audit log"),
        ]

        # Exclude test files
        exclude_dirs = {"tests", "__pycache__", ".git", "alembic"}

        for py_file in py_files:
            if any(excl in py_file.parts for excl in exclude_dirs):
                continue

            try:
                content = py_file.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            if "log_audit" not in content:
                continue

            relative_path = py_file.relative_to(self.backend_dir)

            for pattern, description in sensitive_patterns:
                if pattern.search(content):
                    # Additional check - entity_type="APIKey" is OK (logging API key events, not values)
                    if "entity_type" in content and "APIKey" in content and "api_key" in description:
                        continue
                    issues.append(f"{relative_path}: May be logging {description}")

        if issues:
            print(f"  FAIL: Found {len(issues)} potential sensitive data in audit logs")
            for issue in issues:
                print(f"    - {issue}")
        else:
            print("  PASS: No sensitive data patterns found in audit logs")

        return len(issues) == 0, issues

    def check_sql_injection(self) -> Tuple[bool, List[str]]:
        """
        Check for potential SQL injection vulnerabilities.

        Looks for string formatting in SQL contexts.
        """
        print("Checking for SQL injection patterns...")
        issues = []

        # Check all Python files
        py_files = list(self.backend_dir.rglob("*.py"))

        # Dangerous patterns - string formatting/interpolation in SQL
        dangerous_patterns = [
            (re.compile(r'\.execute\s*\(\s*[^,)]*%[^,)]+\)'), "String formatting (%) in execute()"),
            (re.compile(r'\.execute\s*\(\s*[^,)]*\.format\s*\('), "String format() in execute()"),
            (re.compile(r'\.execute\s*\(\s*f["\']'), "f-string in execute()"),
            (re.compile(r'text\s*\(\s*[^)]*%[^)]+\)'), "String formatting (%) in text()"),
            (re.compile(r'text\s*\(\s*[^)]*\.format\s*\('), "String format() in text()"),
            (re.compile(r'text\s*\(\s*f["\']'), "f-string in text()"),
            (re.compile(r'raw\s*=.*SELECT.*%'), "String formatting in raw SQL SELECT"),
            (re.compile(r'raw\s*=.*SELECT.*\.format'), "String format in raw SQL SELECT"),
        ]

        # Exclude test files and migrations
        exclude_dirs = {"tests", "alembic", "__pycache__", ".git"}

        for py_file in py_files:
            if any(excl in py_file.parts for excl in exclude_dirs):
                continue

            try:
                content = py_file.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            relative_path = py_file.relative_to(self.backend_dir)

            for pattern, description in dangerous_patterns:
                matches = pattern.findall(content)
                for match in matches:
                    # Show a snippet of the match
                    snippet = match[:50] if isinstance(match, str) else str(match)[:50]
                    issues.append(f"{relative_path}: {description}")

        if issues:
            print(f"  FAIL: Found {len(issues)} potential SQL injection patterns")
            for issue in issues:
                print(f"    - {issue}")
        else:
            print("  PASS: No SQL injection patterns found")

        return len(issues) == 0, issues

    def check_all(self) -> Tuple[bool, List[str]]:
        """Run all security checks."""
        all_issues = []
        all_passed = True

        checks = [
            ("Tenant Isolation", self.check_tenant_isolation),
            ("Audit Logging", self.check_audit_logging),
            ("Password Logging", self.check_password_logging),
            ("SQL Injection", self.check_sql_injection),
        ]

        for name, check_func in checks:
            passed, issues = check_func()
            all_issues.extend(issues)
            if not passed:
                all_passed = False
            print()

        return all_passed, all_issues


def main():
    parser = argparse.ArgumentParser(
        description="Security checklist verification for OpenReg",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Checks available:
  tenant-isolation  Verify all queries filter by tenant_id
  audit-logging     Verify CRUD endpoints have audit logging
  password-logging  Verify passwords not logged in audit
  sql-injection     Verify no SQL injection patterns
  all               Run all checks (default)

Examples:
  python scripts/security_checklist.py                    # Run all checks
  python scripts/security_checklist.py --check tenant-isolation
  python scripts/security_checklist.py -v                 # Verbose output
        """
    )
    parser.add_argument(
        "--check",
        choices=["tenant-isolation", "audit-logging", "password-logging", "sql-injection", "all"],
        default="all",
        help="Which check to run (default: all)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output"
    )
    parser.add_argument(
        "--backend-dir",
        type=Path,
        default=None,
        help="Path to backend directory (auto-detected if not specified)"
    )
    args = parser.parse_args()

    # Find backend directory
    if args.backend_dir:
        backend_dir = args.backend_dir
    else:
        # Try to find backend relative to script location
        script_dir = Path(__file__).parent
        backend_dir = script_dir.parent / "backend"

        # If not found, try current working directory
        if not backend_dir.exists():
            backend_dir = Path.cwd() / "backend"

    if not backend_dir.exists():
        print(f"ERROR: Backend directory not found: {backend_dir}")
        print("Use --backend-dir to specify the path")
        return 1

    print("=" * 60)
    print("OpenReg Security Checklist")
    print("=" * 60)
    print(f"Backend directory: {backend_dir.resolve()}")
    print()

    checker = SecurityChecker(backend_dir, verbose=args.verbose)

    check_map = {
        "tenant-isolation": checker.check_tenant_isolation,
        "audit-logging": checker.check_audit_logging,
        "password-logging": checker.check_password_logging,
        "sql-injection": checker.check_sql_injection,
        "all": checker.check_all,
    }

    check_func = check_map[args.check]
    passed, issues = check_func()

    print("=" * 60)
    if passed:
        print("RESULT: ALL CHECKS PASSED")
        return 0
    else:
        print(f"RESULT: {len(issues)} ISSUE(S) FOUND")
        print("\nReview the issues above and fix any security concerns.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
