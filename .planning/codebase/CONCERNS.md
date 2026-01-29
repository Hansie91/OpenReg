# Codebase Concerns

**Analysis Date:** 2026-01-29

## Tech Debt

**Incomplete Schedule Execution Logic:**
- Issue: Schedule-based report triggering is stubbed with TODO comments; critical functionality is not implemented
- Files: `backend/worker.py` (lines 810-820)
- Impact: Scheduled reports cannot execute automatically; users must manually trigger reports or use API
- Fix approach: Implement `check_scheduled_reports()` to query schedules with `next_run_at <= now`, create job runs, enqueue tasks, and update cron expressions

**Missing Email Notifications:**
- Issue: Multiple TODO comments indicate email functionality is incomplete (verification, password reset, notifications)
- Files: `external_api/api/v1/customers/auth.py` (lines 200, 306)
- Impact: User registration email verification and password reset flows cannot complete; authentication workflow broken
- Fix approach: Implement email service integration (SendGrid/SES), configure templates, add rate limiting

**Validation Testing Stubbed:**
- Issue: Test validation endpoint returns placeholder responses instead of actual validation execution
- Files: `backend/api/validations.py` (lines 300-314)
- Impact: Users cannot test validation rules before deployment; no feedback on rule correctness
- Fix approach: Integrate with validation engine to execute SQL and Python expression validators

**Schema Deletion Without Dependency Check:**
- Issue: Schema deletion does not verify if schema is in use by active reports
- Files: `backend/api/schemas.py` (line 259)
- Impact: Deleting schemas can silently break report configurations; no cascade protection
- Fix approach: Query reports/mappings that reference the schema before allowing deletion; raise error or cascade

**Incomplete Run Rerun Endpoint:**
- Issue: POST rerun endpoint for job runs is marked as TODO and not implemented
- Files: `backend/api/runs.py` (lines 244-245)
- Impact: Users cannot rerun failed jobs; must create new job runs manually
- Fix approach: Implement endpoint to clone previous run configuration and enqueue new execution

**Lineage Metadata Incomplete:**
- Issue: Mapping node metadata is not populated with entry count; TODO indicates missing feature
- Files: `backend/services/lineage.py` (line 287)
- Impact: Lineage graph lacks useful metadata; harder to identify data volume issues
- Fix approach: Query mapping table entries count at lineage creation time

## Security Issues

**Unsafe eval() in Validation Testing:**
- Issue: Uses Python `eval()` to execute user-provided validation expressions without proper sandboxing
- Files: `backend/api/validations.py` (line 309)
- Risk: Code injection vulnerability; attacker can execute arbitrary Python code even with `__builtins__` restriction
- Current mitigation: `{"__builtins__": {}}` provides minimal protection but is bypassable
- Recommendations:
  - Use the existing `CodeExecutor.execute()` service (already used elsewhere) for sandboxed execution
  - Implement expression validator with AST parsing (no dynamic execution)
  - Add strict validation testing only to worker processes with resource limits

**Encryption Key Generation Fallback:**
- Issue: If ENCRYPTION_KEY doesn't meet Fernet requirements, code generates a temporary key (losing data access)
- Files: `backend/services/auth.py` (lines 37-45)
- Risk: Credentials encrypted with one key become inaccessible if fallback is triggered; key mismatch silently fails
- Current mitigation: Comment warns "NOT for production" but code still executes
- Recommendations:
  - Validate ENCRYPTION_KEY format at startup; fail fast if invalid
  - Add database migration to re-encrypt credentials with new key
  - Implement key rotation policy

**SQL Injection in Query Timeout:**
- Issue: Query timeout values are interpolated directly into SQL strings using f-strings
- Files: `backend/services/database.py` (lines 547, 549)
- Risk: Malicious timeout values could inject SQL commands (low risk due to integer input, but violates best practices)
- Current mitigation: Timeout is integer input only
- Recommendations:
  - Use parameterized queries or directly set timeout via connection properties
  - Implement input validation to ensure timeout is positive integer <= max allowed

**No Rate Limiting on Authentication:**
- Issue: Login and registration endpoints lack brute force protection
- Files: `external_api/api/v1/customers/auth.py` (lines 215, 180)
- Risk: Credential stuffing and password guessing attacks possible
- Current mitigation: None
- Recommendations:
  - Implement rate limiting per email (5 failed attempts in 15 minutes)
  - Add CAPTCHA for repeated failures
  - Log authentication failures for monitoring

**JWT Claims Not Fully Validated:**
- Issue: JWT validation checks expiration but not all security claims (iss, aud, jti)
- Files: `backend/services/auth.py` (lines 86-87)
- Risk: Tokens from other issuers could be accepted if algorithm/secret matches
- Current mitigation: Claims are present but validation logic may be incomplete
- Recommendations:
  - Verify all claims in token decode: `verify_aud=True`, `verify_iss=True`
  - Add test cases for claim validation

## Performance Bottlenecks

**Large Monolithic Components:**
- Problem: Frontend page components exceed 2000+ lines (Reports.tsx, Admin.tsx, Schedules.tsx)
- Files: `frontend/src/pages/Reports.tsx` (2046 lines), `frontend/src/pages/Admin.tsx` (1328 lines)
- Cause: Multiple features bundled into single component; no component splitting
- Impact: Slow initial render, excessive re-renders, poor code reusability
- Improvement path:
  - Split into smaller, focused components (ReportList, ReportForm, ReportEditor)
  - Extract custom hooks for API calls and state management
  - Implement React.memo() for expensive sub-components
  - Use React DevTools Profiler to identify render bottlenecks

**Large Backend Models File:**
- Problem: Monolithic models.py contains all ORM definitions (1601 lines)
- Files: `backend/models.py`
- Cause: All domain models in one file; no modular organization
- Impact: Slow imports, difficult navigation, schema changes require careful testing
- Improvement path:
  - Split into domain modules: `models/reports.py`, `models/users.py`, `models/workflows.py`
  - Re-export from `__init__.py` for backward compatibility
  - Consider separate database schemas for multi-tenant isolation

**Database Connection Pool Configuration:**
- Problem: Pool size of 10 with max_overflow of 20 may be insufficient under load
- Files: `backend/database.py` (lines 11-12)
- Cause: No dynamic tuning based on workload; hardcoded values
- Impact: Connection exhaustion during high concurrency; 503 errors
- Improvement path:
  - Monitor connection pool utilization in production
  - Implement queue depth monitoring
  - Consider async connections with asyncpg for better concurrency

**No Query Caching:**
- Problem: Reports, connectors, and validation rules queried repeatedly without caching
- Files: `backend/api/reports.py`, `backend/api/connectors.py`, `backend/services/database.py`
- Cause: Every request executes full database query
- Impact: Increased database load, slow list endpoints
- Improvement path:
  - Add Redis caching layer for read-heavy endpoints
  - Implement cache invalidation on write
  - Cache validation rules (rarely change, used on every validation)

**No API Response Pagination:**
- Problem: List endpoints return all records without limit/offset
- Files: Various API files (reports.py, runs.py, schedules.py)
- Cause: No pagination logic implemented
- Impact: Large result sets cause browser memory issues; slow API responses
- Improvement path:
  - Implement offset/limit pagination (skip X, take Y)
  - Add cursor-based pagination for large datasets
  - Set reasonable defaults (limit=50, max_limit=500)

## Fragile Areas

**Circular Import Dependencies:**
- Files: `backend/core/__init__.py`, `backend/core/tenancy.py`
- Why fragile: Multiple lazy import patterns to break cycles between auth and tenancy modules
- Symptoms: Import order matters; circular dependency errors during refactoring
- Safe modification: Any changes to tenancy/security/auth initialization require careful testing
- Test coverage: Unit tests for import order needed; none currently exist
- Mitigation: Add integration test that imports all modules in random order

**Validation Rule Execution Without Sandboxing in API Layer:**
- Files: `backend/api/validations.py` (line 309)
- Why fragile: Direct `eval()` call bypasses CodeExecutor sandboxing
- Symptoms: API validation testing endpoint lacks resource limits and import restrictions
- Safe modification: All validation execution should route through CodeExecutor service
- Test coverage: No security tests for validation endpoint; needs adversarial test cases

**Database Connection Resource Management:**
- Files: `backend/database.py`, `backend/services/database.py`
- Why fragile: Manual cursor/connection lifecycle management with raw SQL
- Symptoms: Connection leaks possible if exception occurs during query execution
- Safe modification: Add context managers for all database operations; test with resource monitors
- Test coverage: No resource leak tests; needs to verify connections are released on exception

**Worker Task State Machine:**
- Files: `backend/services/workflow/executor.py`, `backend/tasks/workflow_tasks.py`
- Why fragile: Complex state transitions (PENDING → RUNNING → SUCCESS/FAILED/PARTIAL)
- Symptoms: State corruption if task retries occur mid-transition; orphaned incomplete states
- Safe modification: Add idempotency checks to all state transitions; test failure scenarios
- Test coverage: Missing tests for partial failure, retry with existing state, concurrent executions

**Frontend API Error Handling:**
- Files: `frontend/src/services/api.ts`
- Why fragile: Generic error handling without retry logic
- Symptoms: Transient network errors cause user-visible failures; no exponential backoff
- Safe modification: Implement retry middleware with exponential backoff for idempotent operations
- Test coverage: No tests for network failure scenarios; needs MSW mock for error cases

## Known Bugs

**Schedule Checking Never Executes:**
- Symptoms: Scheduled reports do not trigger at scheduled times
- Files: `backend/worker.py` (line 810-820)
- Trigger: Set a report schedule with cron expression; observe job not created at scheduled time
- Root cause: `check_scheduled_reports()` function contains only `pass` statement
- Workaround: Manually trigger reports via UI or API until implemented

**Email Verification Missing:**
- Symptoms: Customers can register without email verification; password reset emails not sent
- Files: `external_api/api/v1/customers/auth.py` (lines 200, 306)
- Trigger: Register new customer; observe no verification email received
- Root cause: Email service not implemented; TODOs present
- Workaround: Manually verify customers in database; document bypass procedure

**Schema Deletion Orphans Reports:**
- Symptoms: Report breaks after deleting referenced schema; no error message
- Files: `backend/api/schemas.py` (line 259)
- Trigger: Create report using schema; delete schema; view report
- Root cause: No foreign key constraint; no dependency check on deletion
- Workaround: Document schema dependency before deletion manually

## Security Considerations

**Credentials Storage and Decryption:**
- Risk: Database credentials decrypted in worker processes; if worker compromised, credentials exposed
- Files: `backend/services/database.py` (connection management), `backend/services/auth.py` (get_cipher)
- Current mitigation: Workers run in isolated container; no direct host access
- Recommendations:
  - Use short-lived credential tokens instead of storing credentials
  - Implement credential rotation policy
  - Monitor worker process resource access
  - Consider hardware security module for encryption keys in production

**Python Code Execution in Reports:**
- Risk: Users can execute arbitrary Python code (restricted but not foolproof)
- Files: `backend/services/executor.py` (lines 37-46 BLOCKED_IMPORTS)
- Current mitigation: RestrictedPython limits imports; resource limits applied
- Recommendations:
  - Add process-level isolation (separate process per execution)
  - Implement network policy to block unexpected connections
  - Add telemetry to detect malicious patterns
  - Regular audit of executed code samples

**Missing Input Validation:**
- Risk: API endpoints accept user input without strict validation
- Files: Multiple API files
- Current mitigation: SQLAlchemy ORM provides some protection; no schema validation visible
- Recommendations:
  - Add Pydantic model validation to all endpoints
  - Implement strict input sanitization for dynamic SQL
  - Add OpenAPI validation layer

**No Audit Trail for Sensitive Operations:**
- Risk: Cannot track who made configuration changes
- Files: All API endpoints
- Current mitigation: Created_by user tracking exists for some entities
- Recommendations:
  - Log all CRUD operations with user, timestamp, old/new values
  - Implement audit table for sensitive changes
  - Emit events for compliance audits

## Scaling Limits

**Connection Pool Exhaustion:**
- Current capacity: pool_size=10, max_overflow=20 (max 30 concurrent connections)
- Limit: ~15-20 concurrent users before connection pool saturated
- Scaling path: Increase pool size, implement connection pooling proxy (PgBouncer), migrate to async DB driver

**Worker Memory Usage:**
- Current capacity: WORKER_MAX_MEMORY_MB limit per worker process
- Limit: Large report transformations (100M+ records) may exceed memory before execution timeout
- Scaling path: Implement streaming/chunked processing; add out-of-core computation for large datasets

**Frontend Bundle Size:**
- Current capacity: Large monolithic pages shipped to browser
- Limit: Slow initial load on slow connections; poor mobile experience
- Scaling path: Code splitting, lazy loading, tree shaking unused dependencies

**API Response Latency:**
- Current capacity: No pagination; list endpoints return all records
- Limit: >5 second response times for 10K+ records
- Scaling path: Implement pagination, caching, database query optimization

## Dependencies at Risk

**RestrictedPython Library:**
- Risk: External library for sandboxing; limited community maintenance
- Impact: If vulnerability found in library, all code execution is compromised
- Current version: Unknown (not specified in requirements)
- Migration plan: Monitor for security updates; consider alternative (PyPy sandbox, separate interpreter)

**React Query (Deprecated):**
- Risk: React Query v3 is deprecated; v4+ has breaking changes
- Impact: Missing security fixes, compatibility issues with React 18 ecosystem
- Current version: "react-query": "^3.39.3"
- Migration plan: Migrate to TanStack Query v4 or React Router 6.4+ data loader pattern

**Outdated Python Dependencies:**
- Risk: Backend requirements not pinned; compatibility issues with Python 3.10+
- Impact: Unexpected breaking changes on fresh installs
- Current version: "requires-python = >=3.10"
- Migration plan: Pin all dependencies with hash verification; implement dependabot scanning

## Missing Critical Features

**No Disaster Recovery:**
- Problem: No backup/restore procedures documented; no point-in-time recovery
- Blocks: Cannot recover from data corruption or accidental deletion
- Recommended approach: Implement automated backups with PITR; document recovery procedures

**No Multi-Tenancy Data Isolation:**
- Problem: Tenancy implemented via context variables; no database-level isolation
- Blocks: Risk of cross-tenant data access due to context bugs
- Recommended approach: Use row-level security (RLS) in PostgreSQL for enforcement

**No High Availability:**
- Problem: Single backend instance; no failover; database is single point of failure
- Blocks: Any maintenance requires downtime
- Recommended approach: Implement active-active backend with shared session store; database replication

**No Audit Logging:**
- Problem: Cannot track who changed what when
- Blocks: Regulatory compliance audits; cannot investigate suspicious activity
- Recommended approach: Implement audit table with all CRUD operations; emit audit events to syslog

## Test Coverage Gaps

**Untested Schedule Execution:**
- What's not tested: Schedule matching logic, cron expression parsing, job run creation
- Files: `backend/worker.py` (entire check_scheduled_reports function)
- Risk: Scheduled jobs silently fail without being noticed
- Priority: High (critical feature)

**Untested Email Flows:**
- What's not tested: Email sending, template rendering, failure handling
- Files: `external_api/api/v1/customers/auth.py` (auth endpoints)
- Risk: Broken registration process not caught until production
- Priority: High (user-facing)

**Untested Validation Testing Endpoint:**
- What's not tested: eval() behavior, error handling, malicious input
- Files: `backend/api/validations.py` (test_validation_rule endpoint)
- Risk: Security vulnerability or silent failures
- Priority: High (security critical)

**Untested Schema Deletion Cascades:**
- What's not tested: Foreign key constraints, orphaned reports
- Files: `backend/api/schemas.py` (delete_schema endpoint)
- Risk: Data corruption or broken reports
- Priority: Medium (data integrity)

**Untested Database Connection Failures:**
- What's not tested: Connection timeout, pool exhaustion, failover scenarios
- Files: `backend/database.py`, `backend/services/database.py`
- Risk: Unexpected 503 errors; no graceful degradation
- Priority: Medium (reliability)

**Untested Frontend Error States:**
- What's not tested: Network timeouts, API errors, malformed responses
- Files: `frontend/src/services/api.ts`, all page components
- Risk: User confusion; silent failures
- Priority: Low-Medium (user experience)

---

*Concerns audit: 2026-01-29*
