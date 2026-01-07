# Alembic Migrations

This directory contains database migration scripts managed by Alembic.

## Usage

### Generate a new migration

```bash
# Auto-generate from model changes
cd backend
alembic revision --autogenerate -m "description of changes"

# Create empty migration
alembic revision -m "description"
```

### Apply migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Apply to specific revision
alembic upgrade <revision>

# Apply next migration only
alembic upgrade +1
```

### Rollback migrations

```bash
# Rollback last migration
alembic downgrade -1

# Rollback to specific revision
alembic downgrade <revision>

# Rollback all
alembic downgrade base
```

### View migration status

```bash
# Show current revision
alembic current

# Show migration history
alembic history

# Show pending migrations
alembic history -r current:head
```

## Migration Naming Convention

Files are named with the pattern:
`YYYYMMDD_HHMM_<revision>_<description>.py`

Example: `20260107_1430_abc123_add_token_tracking.py`

## Best Practices

1. Always test migrations locally before deploying
2. Include both `upgrade()` and `downgrade()` functions
3. Use descriptive commit messages
4. Review auto-generated migrations before applying
5. Never modify migrations that have been applied to production
