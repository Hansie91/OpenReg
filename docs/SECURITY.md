# OpenReg Security Architecture

This document describes the security architecture and measures implemented in OpenReg for enterprise deployment.

## Overview

OpenReg implements defense-in-depth security with multiple layers:

1. **Authentication & Authorization** - JWT-based auth with RBAC
2. **Multi-Tenant Isolation** - Database and application-level tenant separation
3. **API Key Security** - Secure generation, hashing, and validation
4. **Input Validation** - Pydantic schemas and query safety checks
5. **Audit Logging** - Comprehensive logging of administrative actions
6. **Secure Code Execution** - Sandboxed Python for user transformations

## 1. Authentication & Authorization

### JWT Token Security

**Implementation:** `backend/services/auth.py`

| Aspect | Implementation | Location |
|--------|----------------|----------|
| Algorithm | HS256 (HMAC-SHA256) | `auth.py:89` |
| Access Token Expiry | 15 minutes (configurable) | `auth.py:77` |
| Refresh Token Expiry | 7 days (configurable) | `auth.py:104` |
| Token Rotation | Refresh tokens rotated on use | `auth.py:93-117` |
| Issuer/Audience | iss/aud claims validated | `auth.py:86-87, 139-140` |
| JTI | Unique token ID for revocation | `auth.py:79, 85` |

**Security Measures:**
- Tokens signed with configurable `SECRET_KEY` (must be set in production)
- Short-lived access tokens minimize exposure window
- Refresh token rotation prevents token reuse attacks
- Tokens include `tenant_id` claim for multi-tenant validation
- JTI (JWT ID) enables server-side token revocation

### Password Security

**Implementation:** `backend/services/auth.py`

| Aspect | Implementation | Location |
|--------|----------------|----------|
| Hashing | bcrypt via passlib | `auth.py:28, 50-52` |
| Work Factor | Default 12 rounds | passlib default |
| Verification | Constant-time comparison | passlib CryptContext |

**Security Measures:**
- bcrypt chosen for intentionally slow hashing (resistant to brute force)
- Passwords never stored in plaintext
- Verification uses constant-time comparison (timing attack resistant)

### Role-Based Access Control (RBAC)

**Implementation:** `backend/models.py`, `backend/services/auth.py`

| Component | Purpose | Location |
|-----------|---------|----------|
| Role model | Defines roles with permissions | `models.py:270-280` |
| AuditAction enum | Action types for logging | `models.py:136-140` |
| UserRole model | User-role assignment | `models.py:283-292` |
| require_permission | Decorator for endpoint protection | `auth.py:452-471` |
| require_admin | Dependency for admin-only endpoints | `auth.py:474-487` |

**Permissions Model:**
- Permissions are additive (user has union of all role permissions)
- Each endpoint can require specific permissions
- Superuser flag bypasses all permission checks
- Wildcard patterns supported (e.g., `report:*` matches `report:create`)

## 2. Multi-Tenant Isolation

### Overview

OpenReg is a multi-tenant system where each tenant's data is completely isolated. Three layers enforce this isolation:

1. **Database Layer** - All models have `tenant_id` foreign key
2. **Session Layer** - `TenantScopedSession` auto-filters queries
3. **API Layer** - Explicit tenant validation in endpoint handlers

### Database-Level Isolation

**Implementation:** `backend/models.py`

Every data model includes a `tenant_id` column:

```python
class Report(Base):
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    # ... other fields
```

**Models with tenant_id (exhaustive list):**
- User, Role, UserRole
- Report, ReportVersion, ReportValidation
- Connector, MappingSet, CrossReferenceEntry
- Destination, Schedule, Trigger
- ValidationRule, ValidationResult, ValidationException
- AuditLog, JobRun, JobRunLog
- FileSubmission, RecordSubmission, RecordStatusHistory
- StreamingTopic, StreamingBuffer, StreamingConsumerState
- LineageNode, LineageEdge
- APIKey, Artifact

### Session-Level Isolation

**Implementation:** `backend/core/tenancy.py`

The `TenantScopedSession` class automatically applies tenant filters:

| Component | Purpose | Location |
|-----------|---------|----------|
| TENANT_SCOPED_MODELS | List of models requiring tenant filter | `tenancy.py:37-46` |
| TenantScopedSession | Session class that auto-filters | `tenancy.py:87-144` |
| TenantContext | Context manager for tenant scope | `tenancy.py:49-69` |
| get_current_tenant_id | Gets tenant from context var | `tenancy.py:72-74` |

**How it works:**
1. Request middleware extracts tenant from JWT or API key
2. `TenantContext` or `set_tenant_id()` stores tenant_id in context
3. All queries on TENANT_SCOPED_MODELS automatically add `WHERE tenant_id = :tenant_id`

```python
# This query...
db.query(Report).filter(Report.name == "Q1")
# Becomes automatically...
db.query(Report).filter(Report.name == "Q1", Report.tenant_id == current_tenant_id)
```

### API-Level Isolation

**Implementation:** All `backend/api/*.py` files

Even with automatic session filtering, API endpoints include explicit tenant validation:

```python
@router.get("/{report_id}")
def get_report(report_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.query(Report).filter(
        Report.id == report_id,
        Report.tenant_id == current_user.tenant_id  # Explicit check
    ).first()
    if not report:
        raise HTTPException(status_code=404)  # Returns 404, not 403
```

**Security Note:** Returns 404 (not 403) when tenant mismatch - prevents ID enumeration attacks.

### Tenant Isolation Verification

**Implementation:** `backend/core/tenancy.py:275-299`

Helper functions for explicit tenant checks:

| Function | Purpose | Location |
|----------|---------|----------|
| require_tenant_match | Raises 404 on mismatch | `tenancy.py:275-299` |
| verify_tenant_access | Returns bool or raises | `tenancy.py:326-356` |
| tenant_filter | Applies filter to query | `tenancy.py:302-318` |

Run the security checklist to verify tenant isolation:

```bash
python scripts/security_checklist.py --check tenant-isolation
```

## 3. API Key Security

### Key Generation

**Implementation:** `backend/core/security.py`

| Aspect | Implementation | Location |
|--------|----------------|----------|
| Format | `openreg_` prefix + 32 random bytes | `security.py:26-35` |
| Entropy | 256 bits (cryptographically secure) | `secrets.token_urlsafe(32)` |
| Encoding | URL-safe base64 | `security.py:33` |

**Key Format:** `openreg_AbCdEf123456...` (prefix identifies as OpenReg key)

### Key Storage

**Implementation:** `backend/core/security.py`, `backend/models.py`

| Aspect | Implementation | Location |
|--------|----------------|----------|
| Hashing | SHA-256 | `security.py:38-40` |
| Storage | Only hash stored, never plaintext | `models.py:1330` |
| Display | Key shown ONCE at creation | API response only |

**Security Measures:**
- Raw key returned only at creation time
- Database stores only SHA-256 hash
- Lost keys cannot be recovered (must create new)

### Key Validation

**Implementation:** `backend/services/auth.py`

| Aspect | Implementation | Location |
|--------|----------------|----------|
| Lookup | Hash input, query by hash | `auth.py:256-261` |
| Timing | Constant-time hash comparison | SHA-256 property |
| Expiration | Checked against `expires_at` | `auth.py:267-268` |
| IP Whitelist | Checked against `allowed_ips` | `auth.py:271-273` |

### Additional Key Controls

**Implementation:** `backend/models.py:1309-1356`

| Control | Purpose | Field |
|---------|---------|-------|
| `is_active` | Quick revocation | `models.py:1341` |
| `revoked_at` | Revocation timestamp | `models.py:1349` |
| `expires_at` | Time-based expiration | `models.py:1342` |
| `allowed_ips` | IP whitelist (JSON array) | `models.py:1335` |
| `rate_limit_per_minute` | Per-key rate limiting | `models.py:1338` |
| `permissions` | Permission scopes (JSON array) | `models.py:1334` |

## 4. Input Validation

### Pydantic Schema Validation

**Implementation:** All `backend/api/*.py` files

Every API endpoint uses Pydantic models for input validation:

```python
class ReportCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    connector_id: UUID
    mapping_set_id: Optional[UUID] = None
    output_format: str = Field(..., pattern="^(csv|json|xml|xbrl)$")
```

**Validation Features:**
- Type coercion and validation
- Length constraints (min_length, max_length)
- Pattern matching (regex validation)
- Required vs optional fields
- Custom validators for complex rules

### Query Safety

**Implementation:** `backend/services/query_safety.py`

For endpoints that accept user-provided SQL (custom queries), the query safety service blocks dangerous patterns:

| Pattern | Blocked | Location |
|---------|---------|----------|
| `DROP TABLE/DATABASE` | Yes | `query_safety.py:64` |
| `TRUNCATE TABLE` | Yes | `query_safety.py:65` |
| `DELETE FROM ... (no WHERE)` | Yes | `query_safety.py:66` |
| `ALTER TABLE/DATABASE` | Yes | `query_safety.py:67` |
| `CREATE TABLE/DATABASE` | Yes | `query_safety.py:68` |
| `; --` | Yes | `query_safety.py:71` |
| `' OR '1'='1` | Yes | `query_safety.py:72` |
| `UNION ALL SELECT` | Yes | `query_safety.py:73` |

**Additional Safeguards:**

| Feature | Default | Location |
|---------|---------|----------|
| Query timeout | 60 seconds | `query_safety.py:49` |
| Max timeout | 300 seconds | `query_safety.py:48` |
| Row limit | 10,000 | `query_safety.py:51` |
| Max row limit | 100,000 | `query_safety.py:50` |

### XML Security

**Implementation:** `backend/requirements.txt`

Uses `defusedxml` library for safe XML parsing:

| Attack | Protection |
|--------|------------|
| XXE (XML External Entity) | Disabled external entity loading |
| Billion Laughs | Entity expansion limits |
| DTD Processing | Disabled by default |

### Code Execution Sandbox

**Implementation:** Uses `RestrictedPython` for user-provided transformation code

| Control | Implementation |
|---------|----------------|
| Import restrictions | Whitelisted modules only |
| Built-in restrictions | Safe subset of builtins |
| Execution timeout | Configurable limit |
| Memory limits | OS-level restrictions |

## 5. Audit Logging

### Audit Log Structure

**Implementation:** `backend/models.py:800-815`, `backend/services/auth.py:513-535`

| Field | Purpose | Location |
|-------|---------|----------|
| `tenant_id` | Multi-tenant context | `models.py:804` |
| `user_id` | Actor who performed action | `models.py:805` |
| `entity_type` | Type of resource modified | `models.py:806` |
| `entity_id` | ID of resource modified | `models.py:807` |
| `action` | Type of action (CREATE/UPDATE/DELETE/EXECUTE) | `models.py:808` |
| `changes` | What changed (JSON) | `models.py:809` |
| `ip_address` | Client IP address | `models.py:810` |
| `user_agent` | Client user agent | `models.py:811` |
| `created_at` | Timestamp | `models.py:812` |

### Logged Actions

All administrative actions are logged:

| Category | Actions Logged |
|----------|----------------|
| Users | Create, Update, Delete |
| Roles | Create, Update, Delete |
| Reports | Create, Update, Delete, Execute |
| Connectors | Create, Update, Delete |
| Destinations | Create, Update, Delete |
| Schedules | Create, Update, Delete, Toggle |
| Webhooks | Create, Update, Delete, Toggle |
| Mappings | Create, Update, Delete |
| Validation Rules | Create, Update, Delete |
| API Keys | Create, Revoke, Rotate |
| External API | Create, Update, Delete, Sync |
| Settings | Update |

### Sensitive Data Exclusion

Audit logs NEVER contain:
- Passwords (hashed or plaintext)
- API keys (raw or hashed)
- Connection credentials
- Webhook secrets
- JWT tokens

## 6. Credential Storage

### Connection Credentials

**Implementation:** `backend/services/auth.py`

| Aspect | Implementation | Location |
|--------|----------------|----------|
| Encryption | Fernet symmetric encryption | `auth.py:37-45` |
| Key | Derived from `ENCRYPTION_KEY` env var | `auth.py:40` |
| Encrypt | `encrypt_credentials()` function | `auth.py:492-497` |
| Decrypt | `decrypt_credentials()` function | `auth.py:500-508` |

**Security Measures:**
- Credentials encrypted at rest
- Decrypted only when needed for connection
- Encryption key must be set in production

### Weak Secret Detection

**Implementation:** `backend/core/security.py:55-92`

The `is_weak_secret()` function detects common weak credentials:

| Pattern | Detection |
|---------|-----------|
| Common passwords | "password", "admin", "12345" |
| Placeholder text | "your-secret", "change-me", "example" |
| Development values | "development", "dev-key", "test-key" |
| Short secrets | Less than 32 characters |

## 7. Constant-Time Operations

**Implementation:** `backend/core/security.py:109-111`

Security-sensitive comparisons use constant-time algorithms to prevent timing attacks:

```python
def constant_time_compare(a: str, b: str) -> bool:
    """Compare two strings in constant time to prevent timing attacks."""
    return secrets.compare_digest(a.encode(), b.encode())
```

## Security Verification

### Running the Security Checklist

```bash
# Full security check
python scripts/security_checklist.py

# Specific checks
python scripts/security_checklist.py --check tenant-isolation
python scripts/security_checklist.py --check audit-logging
python scripts/security_checklist.py --check password-logging
python scripts/security_checklist.py --check sql-injection

# Verbose output
python scripts/security_checklist.py -v
```

### Verification Checks

The security checklist verifies:
- All API files with queries include tenant_id filtering
- All CRUD endpoints have audit logging
- No passwords/secrets appear in audit log calls
- No raw SQL injection patterns in code
- All models have tenant_id where expected

## Production Deployment Checklist

Before deploying to production, ensure:

### Environment Variables

| Variable | Purpose | Security Note |
|----------|---------|---------------|
| `SECRET_KEY` | JWT signing key | Must be unique, 32+ chars |
| `ENCRYPTION_KEY` | Credential encryption | Must be valid Fernet key (32 bytes base64) |
| `DATABASE_URL` | PostgreSQL connection | Use SSL, strong password |
| `REDIS_URL` | Redis connection | Use AUTH, SSL if exposed |

### Infrastructure

- [ ] HTTPS enabled (TLS 1.2+)
- [ ] Database backups encrypted
- [ ] Network segmentation (API, DB, Redis)
- [ ] Firewall rules (restrict DB/Redis access)
- [ ] Rate limiting at load balancer
- [ ] DDoS protection

### Monitoring

- [ ] Audit logs shipped to SIEM
- [ ] Failed login monitoring
- [ ] API key usage monitoring
- [ ] Error rate alerting

### Pre-Deployment Verification

```bash
# Run security checklist
python scripts/security_checklist.py

# Verify no weak secrets
python -c "from core.security import is_weak_secret; import os; print('WEAK!' if is_weak_secret(os.getenv('SECRET_KEY', '')) else 'OK')"
```

## Vulnerability Disclosure

If you discover a security issue:

1. **Do not** open a public issue
2. Email security concerns to the project maintainers
3. Include: Description, steps to reproduce, impact assessment
4. Expected response within 48 hours
5. Credit provided in release notes (unless anonymity preferred)

---

*Document Version: 2.0*
*Last Updated: Phase 4 - Enterprise Readiness*
*See also: `scripts/security_checklist.py` for automated verification*
