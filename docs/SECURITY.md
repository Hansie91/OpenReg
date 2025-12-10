# Security Model

## Overview

OpenRegReport Portal implements multiple layers of security to protect sensitive data and ensure regulatory compliance.

## Authentication

### JWT Tokens
- **Access Tokens**: 15-minute expiry, used for API requests
- **Refresh Tokens**: 7-day expiry, used to obtain new access tokens
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Storage**: Client-side in localStorage (consider httpOnly cookies for production)

### Password Security
- **Hashing**: bcrypt with automatic salt
- **Minimum Requirements**: Enforce in production (8+ chars, complexity rules)
- **Password Reset**: Implement email-based reset flow (v1)

## Authorization (RBAC)

### Permission Model
```
Permission: "resource:action"
Examples:
  - "report:create"
  - "report:read"
  - "report:execute"
  - "connector:create"
  - "run:view_logs"
```

### Built-in Roles
- **Administrator**: Wildcard permission (`*`)
- **Report Manager**: `report:*`, `run:*`, `connector:read`
- **Report Viewer**: `report:read`, `run:read`

### Role Assignment
- Users can have multiple roles
- Permissions are union of all role permissions
- Superuser flag bypasses all permission checks

## Data Encryption

### At Rest

**Credentials (DB, SFTP)**
- Encrypted using **Fernet** (symmetric encryption)
- Key stored in environment variable `ENCRYPTION_KEY`
- Never logs decrypted credentials
- Decryption only in worker processes (ephemeral)

**Database**
- PostgreSQL: Enable encryption at rest (production)
- MinIO: Server-side encryption (SSE-S3 or SSE-KMS)

### In Transit
- **HTTPS**: All external traffic over TLS 1.2+
- **Database**: SSL/TLS connections (enforce in production)
- **SFTP/FTP**: Encrypted protocols (SFTP preferred over FTP)

## Network Security

### Container Isolation
- Workers run in separate Docker network
- Only backend and workers access database
- MinIO not exposed publicly (access via backend proxy)

### Firewall Rules (Production)
```
Allow:
  - 443/tcp (HTTPS)
  - Internal container network

Block:
  - 5432/tcp (PostgreSQL) from external
  - 6379/tcp (Redis) from external
  - 9000/tcp (MinIO) from external
```

## Sandboxed Python Execution

### Worker Isolation
- Separate Docker container for workers
- No access to host filesystem
- No network access except whitelisted DB hosts and SFTP destinations

### Resource Limits
```yaml
CPU: 2 cores max
Memory: 2GB max
Execution Time: 1 hour max (configurable per report)
```

### Restricted Imports
**Allowed Libraries:**
- pandas, numpy, lxml, requests (for HTTP APIs)
- datetime, json, csv, hashlib
- Custom allowlist defined in worker config

**Blocked:**
- `os`, `subprocess`, `socket` (direct execution)
- `eval`, `exec`, `compile` (arbitrary code)
- Any library not in allowlist

## Audit Logging

### What We Log
- **Authentication**: Login attempts, token refreshes, logouts
- **Authorization**: Permission denials (for security monitoring)
- **Configuration Changes**: All CRUD operations on reports, connectors, etc.
- **Execution**: Report runs, validations, deliveries
- **Data Access**: Connector usage, artifact downloads

### Log Format
```json
{
  "tenant_id": "uuid",
  "user_id": "uuid",
  "entity_type": "Report",
  "entity_id": "uuid",
  "action": "update",
  "changes": {"name": {"old": "Old Name", "new": "New Name"}},
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2025-01-01T12:00:00Z"
}
```

### Retention
- Default: 2 years (adjustable for compliance)
- Immutable: Append-only table (no updates/deletes)

## Multi-Tenancy

### Data Isolation
- All queries filtered by `tenant_id`
- PostgreSQL RLS as defense-in-depth (v2)
- Separate MinIO buckets per tenant (optional)

### Tenant Switching
- Prevent cross-tenant access via API
- JWT contains `tenant_id` claim
- All endpoints validate tenant ownership

## Secrets Management

### MVP
- Environment variables
- Fernet encryption for database storage

### Production (v1)
- **HashiCorp Vault**: Dynamic credentials, secret rotation
- **AWS Secrets Manager / Azure Key Vault**: Cloud-native options
- **Kubernetes Secrets**: Encrypted at rest (etcd encryption)

### Secret Rotation
- Database passwords: Quarterly rotation recommended
- Encryption keys: Annual rotation
- JWT secret: Emergency rotation procedure

## Security Hardening Checklist

### Pre-Production
- [ ] Generate strong `SECRET_KEY` and `ENCRYPTION_KEY`
- [ ] Change all default passwords
- [ ] Enable TLS for all services
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Review and minimize CORS origins
- [ ] Enable PostgreSQL SSL mode
- [ ] Configure rate limiting

### Production Operations
- [ ] Monitor failed login attempts
- [ ] Set up alerts for permission denials
- [ ] Regular dependency updates (Dependabot, Snyk)
- [ ] Quarterly access reviews (remove inactive users)
- [ ] Penetration testing annually
- [ ] Incident response plan
- [ ] Data breach notification procedures

### Compliance (if applicable)
- [ ] GDPR: Data subject access, right to erasure
- [ ] SOC 2: Access controls, encryption, logging
- [ ] ISO 27001: Risk assessment, ISMS documentation

## Vulnerability Disclosure

If you discover a security issue, please:
1. **Do not** open a public issue
2. Email: security@openreg.example (set this up)
3. Include: Description, steps to reproduce, impact
4. We'll respond within 48 hours
5. We'll credit you in release notes (unless you prefer anonymity)

## Known Limitations (MVP)

- **localStorage JWT**: Vulnerable to XSS (use httpOnly cookies in v1)
- **No MFA**: Add TOTP support in v1
- **No session management**: Implement active session tracking in v1
- **Fernet key in .env**: Migrate to Vault in production

---

**Threat Model**: See `docs/THREAT_MODEL.md` (TODO for v1)

**Security Policy**: See `SECURITY.md` (TODO)
