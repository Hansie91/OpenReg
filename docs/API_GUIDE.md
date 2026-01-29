# OpenReg API Guide

Complete reference for the OpenReg REST API.

## Overview

**Base URL:** `http://localhost:8000/api/v1`

**Authentication:** JWT Bearer tokens or API Key

**Content-Type:** `application/json`

**Interactive Documentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/api/v1/openapi.json

## Quick Reference

| Category | Endpoints | Description |
|----------|-----------|-------------|
| [Authentication](#authentication) | `/auth/*` | Login, logout, token refresh |
| [Reports](#reports) | `/reports/*` | Report CRUD and execution |
| [Runs](#runs) | `/runs/*` | Job execution history |
| [Connectors](#connectors) | `/connectors/*` | Database connections |
| [Destinations](#destinations) | `/destinations/*` | SFTP/FTP delivery targets |
| [Schedules](#schedules) | `/schedules/*` | Cron and calendar scheduling |
| [Validations](#validations) | `/validations/*` | Validation rules |
| [Mappings](#mappings) | `/mappings/*` | Cross-reference data |
| [Delivery](#delivery) | `/delivery/*` | Artifact delivery management |
| [Submissions](#submissions) | `/submissions/*` | Regulatory file submissions |
| [Workflow](#workflow) | `/workflow/*` | Workflow status and control |
| [Webhooks](#webhooks) | `/webhooks/*` | Event notifications |
| [API Keys](#api-keys) | `/api-keys/*` | Programmatic access |
| [Admin](#admin) | `/admin/*` | User and role management |
| [Dashboard](#dashboard) | `/dashboard/*` | Summary statistics |
| [External API](#external-api) | `/external-api/*` | External regulatory sync |

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created |
| 204 | No Content - Successful deletion |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 422 | Validation Error - Request body failed validation |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Error Response Format

```json
{
  "detail": "Error message here"
}
```

For validation errors (422):

```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Authentication

OpenReg supports two authentication methods:

1. **JWT Bearer Tokens** - For interactive sessions (access + refresh tokens)
2. **API Keys** - For programmatic/M2M integrations (X-API-Key header)

### Login

Authenticate and receive JWT tokens.

```
POST /api/v1/auth/login
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

**Python Example:**

```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/auth/login",
    json={"email": "admin@example.com", "password": "admin123"}
)
tokens = response.json()
access_token = tokens["access_token"]
print(f"Token expires in {tokens['expires_in']} seconds")
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@example.com",
    "full_name": "Admin User",
    "tenant_id": "tenant-uuid",
    "is_superuser": true
  }
}
```

**Error Response (401):**

```json
{
  "detail": "Incorrect email or password"
}
```

### Using Tokens

Include the access token in the `Authorization` header:

```bash
curl http://localhost:8000/api/v1/reports \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Python Example:**

```python
headers = {"Authorization": f"Bearer {access_token}"}
response = requests.get("http://localhost:8000/api/v1/reports", headers=headers)
```

### Refresh Token

Get a new access token using the refresh token. Implements token rotation (old refresh token is revoked).

```
POST /api/v1/auth/refresh
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

**Response (200):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": { ... }
}
```

### Get Current User

```
GET /api/v1/auth/me
```

**Request:**

```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com",
  "full_name": "Admin User",
  "tenant_id": "tenant-uuid",
  "is_active": true,
  "is_superuser": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Logout

Revoke the current access token.

```
POST /api/v1/auth/logout
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**

```json
{
  "message": "Successfully logged out"
}
```

### Logout All Sessions

Revoke all tokens for the user (all devices).

```
POST /api/v1/auth/logout-all
```

**Response (200):**

```json
{
  "message": "Successfully logged out from all sessions",
  "sessions_revoked": 3
}
```

### Get Active Sessions

```
GET /api/v1/auth/sessions
```

**Response (200):**

```json
{
  "sessions": [
    {
      "jti": "session-id",
      "created_at": "2024-01-01T00:00:00Z",
      "metadata": {"ip": "192.168.1.1", "user_agent": "Mozilla/5.0..."}
    }
  ],
  "count": 1
}
```

---

## Reports

Manage regulatory reports, versions, and execution.

### List Reports

```
GET /api/v1/reports
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| skip | int | Pagination offset (default: 0) |
| limit | int | Max results (default: 100) |
| is_active | bool | Filter by active status |

**Request:**

```bash
curl http://localhost:8000/api/v1/reports \
  -H "Authorization: Bearer $TOKEN"
```

**Python Example:**

```python
response = requests.get(
    "http://localhost:8000/api/v1/reports",
    headers=headers,
    params={"is_active": True, "limit": 10}
)
reports = response.json()
```

**Response (200):**

```json
[
  {
    "id": "report-uuid",
    "tenant_id": "tenant-uuid",
    "name": "MiFIR Daily Transaction Report",
    "description": "Daily transaction reporting under RTS 25",
    "current_version_id": "version-uuid",
    "major_version": 1,
    "minor_version": 2,
    "version_string": "v1.2",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T00:00:00Z"
  }
]
```

### Create Report

```
POST /api/v1/reports
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "EMIR Trade Report",
    "description": "EMIR Refit derivative reporting",
    "connector_id": "connector-uuid"
  }'
```

**Response (201):**

```json
{
  "id": "new-report-uuid",
  "tenant_id": "tenant-uuid",
  "name": "EMIR Trade Report",
  "description": "EMIR Refit derivative reporting",
  "current_version_id": null,
  "is_active": true,
  "created_at": "2024-01-20T00:00:00Z",
  "updated_at": "2024-01-20T00:00:00Z"
}
```

### Get Report

```
GET /api/v1/reports/{report_id}
```

**Request:**

```bash
curl http://localhost:8000/api/v1/reports/report-uuid \
  -H "Authorization: Bearer $TOKEN"
```

### Update Report

```
PUT /api/v1/reports/{report_id}
```

**Request:**

```bash
curl -X PUT http://localhost:8000/api/v1/reports/report-uuid \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Report Name",
    "is_active": false
  }'
```

### Delete Report

```
DELETE /api/v1/reports/{report_id}
```

**Request:**

```bash
curl -X DELETE http://localhost:8000/api/v1/reports/report-uuid \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** 204 No Content

### Create Report Version

Create a new version of a report with transformation code.

```
POST /api/v1/reports/{report_id}/versions
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/reports/report-uuid/versions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "python_code": "def transform(db, mappings, params):\n    return db.execute(\"SELECT * FROM trades\").fetchall()",
    "connector_id": "connector-uuid",
    "config": {"output_format": "xml"},
    "bump_major": false
  }'
```

**Response (201):**

```json
{
  "id": "version-uuid",
  "report_id": "report-uuid",
  "major_version": 1,
  "minor_version": 3,
  "version_number": 1003,
  "version_string": "v1.3",
  "python_code": "def transform...",
  "connector_id": "connector-uuid",
  "config": {"output_format": "xml"},
  "status": "active",
  "created_at": "2024-01-20T00:00:00Z"
}
```

### List Report Versions

```
GET /api/v1/reports/{report_id}/versions
```

**Response (200):**

```json
[
  {
    "id": "version-uuid",
    "version_string": "v1.3",
    "status": "active",
    "created_at": "2024-01-20T00:00:00Z"
  },
  {
    "id": "older-version-uuid",
    "version_string": "v1.2",
    "status": "archived",
    "created_at": "2024-01-10T00:00:00Z"
  }
]
```

### Execute Report

Trigger manual execution of a report.

```
POST /api/v1/reports/{report_id}/execute
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/reports/report-uuid/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "business_date": "2024-01-19",
      "include_amendments": true
    }
  }'
```

**Python Example:**

```python
response = requests.post(
    f"http://localhost:8000/api/v1/reports/{report_id}/execute",
    headers=headers,
    json={"parameters": {"business_date": "2024-01-19"}}
)
job = response.json()
print(f"Job queued: {job['job_run_id']}")
```

**Response (200):**

```json
{
  "job_run_id": "job-run-uuid",
  "status": "pending",
  "message": "Report execution queued"
}
```

### Get Report Execution History

```
GET /api/v1/reports/{report_id}/executions
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| skip | int | Pagination offset |
| limit | int | Max results |
| status | string | Filter by status (pending, running, success, failed) |
| from_date | datetime | Filter runs after this date |
| to_date | datetime | Filter runs before this date |

**Response (200):**

```json
{
  "total": 25,
  "skip": 0,
  "limit": 100,
  "data": [
    {
      "id": "job-run-uuid",
      "status": "success",
      "triggered_by": "manual",
      "created_at": "2024-01-20T00:00:00Z",
      "duration_seconds": 12.5,
      "artifact_count": 1
    }
  ]
}
```

### Get Report Statistics

```
GET /api/v1/reports/{report_id}/stats
```

**Response (200):**

```json
{
  "total_executions": 50,
  "by_status": {
    "success": 45,
    "failed": 3,
    "pending": 2
  },
  "success_rate": 93.75,
  "avg_duration_seconds": 15.2,
  "last_30_days_trend": { ... },
  "last_execution": {
    "status": "success",
    "created_at": "2024-01-20T00:00:00Z"
  }
}
```

### Link Destination to Report

Configure automatic delivery after report execution.

```
POST /api/v1/reports/{report_id}/destinations
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/reports/report-uuid/destinations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destination_id": "destination-uuid"}'
```

**Response (200):**

```json
{
  "message": "Destination linked successfully",
  "destination_name": "Regulator SFTP"
}
```

---

## Runs

View and manage job execution runs.

### List Runs

```
GET /api/v1/runs
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| skip | int | Pagination offset |
| limit | int | Max results |
| status | string | Filter by status |
| report_id | UUID | Filter by report |
| from_date | datetime | Start date filter |
| to_date | datetime | End date filter |

**Request:**

```bash
curl "http://localhost:8000/api/v1/runs?status=success&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**

```json
{
  "total": 150,
  "skip": 0,
  "limit": 10,
  "data": [
    {
      "id": "job-run-uuid",
      "report_id": "report-uuid",
      "report_name": "MiFIR Daily Transaction Report",
      "status": "success",
      "triggered_by": "schedule",
      "created_at": "2024-01-20T06:00:00Z",
      "started_at": "2024-01-20T06:00:01Z",
      "ended_at": "2024-01-20T06:00:15Z",
      "artifact_count": 1,
      "first_artifact_id": "artifact-uuid",
      "first_artifact_filename": "mifir_20240120.xml"
    }
  ]
}
```

### Get Run Details

```
GET /api/v1/runs/{run_id}/details
```

**Response (200):**

```json
{
  "id": "job-run-uuid",
  "report": {
    "id": "report-uuid",
    "name": "MiFIR Daily Transaction Report"
  },
  "version_number": 1003,
  "triggered_by": "manual",
  "status": "success",
  "parameters": {"business_date": "2024-01-19"},
  "timeline": {
    "created_at": "2024-01-20T00:00:00Z",
    "started_at": "2024-01-20T00:00:01Z",
    "ended_at": "2024-01-20T00:00:15Z",
    "duration_seconds": 14
  },
  "validation_results": {
    "total": 5,
    "passed": 5,
    "failed": 0,
    "details": [ ... ]
  },
  "artifacts": [
    {
      "id": "artifact-uuid",
      "filename": "mifir_20240120.xml",
      "size_bytes": 125000,
      "mime_type": "application/xml"
    }
  ]
}
```

### List Run Artifacts

```
GET /api/v1/runs/{run_id}/artifacts
```

### Download Artifact

```
GET /api/v1/runs/{run_id}/artifacts/{artifact_id}/download
```

**Request:**

```bash
curl http://localhost:8000/api/v1/runs/run-uuid/artifacts/artifact-uuid/download \
  -H "Authorization: Bearer $TOKEN" \
  -o report.xml
```

**Python Example:**

```python
response = requests.get(
    f"http://localhost:8000/api/v1/runs/{run_id}/artifacts/{artifact_id}/download",
    headers=headers
)
with open("report.xml", "wb") as f:
    f.write(response.content)
```

---

## Connectors

Manage database connections for data sourcing.

### List Connectors

```
GET /api/v1/connectors
```

**Response (200):**

```json
[
  {
    "id": "connector-uuid",
    "name": "Trading Database",
    "description": "Production trading system",
    "type": "postgresql",
    "config": {
      "host": "db.example.com",
      "port": 5432,
      "database": "trading"
    },
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Create Connector

```
POST /api/v1/connectors
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/connectors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trading Database",
    "description": "Production trading system",
    "type": "postgresql",
    "config": {
      "host": "db.example.com",
      "port": 5432,
      "database": "trading"
    },
    "credentials": {
      "username": "report_user",
      "password": "secure_password"
    }
  }'
```

**Supported Types:** `postgresql`, `sqlserver`, `oracle`, `mysql`, `odbc`

### Test Connection (Before Save)

Test connection parameters without saving.

```
POST /api/v1/connectors/test
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/connectors/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql",
    "config": {"host": "db.example.com", "port": 5432, "database": "trading"},
    "credentials": {"username": "user", "password": "pass"}
  }'
```

**Response (200):**

```json
{
  "status": "ok",
  "message": "Connection successful",
  "server_version": "PostgreSQL 15.4"
}
```

### Test Existing Connector

```
POST /api/v1/connectors/{connector_id}/test
```

### List Tables

```
GET /api/v1/connectors/{connector_id}/tables
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| schema_name | string | Filter by schema |

**Response (200):**

```json
{
  "tables": [
    {"schema": "public", "name": "trades"},
    {"schema": "public", "name": "instruments"},
    {"schema": "public", "name": "counterparties"}
  ]
}
```

### List Columns

```
GET /api/v1/connectors/{connector_id}/columns?table=trades
```

**Response (200):**

```json
{
  "columns": [
    {"name": "id", "type": "uuid", "nullable": false},
    {"name": "trade_date", "type": "date", "nullable": false},
    {"name": "isin", "type": "varchar(12)", "nullable": true}
  ]
}
```

### Preview Table Data

```
GET /api/v1/connectors/{connector_id}/preview?table=trades&limit=5
```

---

## Destinations

Manage SFTP/FTP delivery endpoints.

### List Destinations

```
GET /api/v1/destinations
```

**Response (200):**

```json
[
  {
    "id": "destination-uuid",
    "name": "Regulator SFTP",
    "protocol": "sftp",
    "host": "sftp.regulator.eu",
    "port": 22,
    "username": "reporting_user",
    "directory": "/inbound/mifir",
    "retry_count": 3,
    "retry_backoff": "exponential",
    "is_active": true
  }
]
```

### Create Destination

```
POST /api/v1/destinations
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/destinations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Regulator SFTP",
    "protocol": "sftp",
    "host": "sftp.regulator.eu",
    "port": 22,
    "username": "reporting_user",
    "password": "secure_password",
    "directory": "/inbound/mifir",
    "retry_count": 3,
    "retry_backoff": "exponential",
    "retry_base_delay": 5,
    "retry_max_delay": 300
  }'
```

### Test Connection

```
POST /api/v1/destinations/test
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/destinations/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "protocol": "sftp",
    "host": "sftp.regulator.eu",
    "port": 22,
    "username": "user",
    "password": "pass",
    "directory": "/inbound"
  }'
```

**Response (200):**

```json
{
  "success": true,
  "message": "Connection successful. Directory accessible."
}
```

---

## Schedules

Configure automated report execution.

### List Schedules

```
GET /api/v1/schedules
```

**Response (200):**

```json
[
  {
    "id": "schedule-uuid",
    "name": "Daily MiFIR",
    "report_id": "report-uuid",
    "report_name": "MiFIR Daily Transaction Report",
    "schedule_type": "cron",
    "cron_expression": "0 6 * * *",
    "is_active": true,
    "next_run_at": "2024-01-21T06:00:00Z",
    "last_run_at": "2024-01-20T06:00:00Z",
    "last_run_status": "success"
  }
]
```

### Create Schedule (Cron)

```
POST /api/v1/schedules
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/schedules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily MiFIR at 6 AM",
    "report_id": "report-uuid",
    "schedule_type": "cron",
    "cron_expression": "0 6 * * *",
    "is_active": true,
    "parameters": {"include_amendments": true}
  }'
```

### Create Schedule (Calendar)

```
POST /api/v1/schedules
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/schedules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekday Report",
    "report_id": "report-uuid",
    "schedule_type": "calendar",
    "calendar_config": {
      "frequency": "weekly",
      "time_slots": ["09:00", "17:00"],
      "weekly_days": [0, 1, 2, 3, 4],
      "exclusion_dates": ["2024-12-25", "2024-01-01"],
      "timezone": "Europe/London"
    }
  }'
```

### Toggle Schedule (Pause/Resume)

```
PUT /api/v1/schedules/{schedule_id}/toggle
```

### Preview Schedule

Preview upcoming run times before saving.

```
POST /api/v1/schedules/preview
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/schedules/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "frequency": "weekly",
    "time_slots": ["09:00"],
    "weekly_days": [0, 1, 2, 3, 4],
    "timezone": "Europe/London"
  }'
```

**Response (200):**

```json
{
  "upcoming_runs": [
    "2024-01-22T09:00:00Z",
    "2024-01-23T09:00:00Z",
    "2024-01-24T09:00:00Z"
  ],
  "next_blackout": null
}
```

---

## Validations

Manage validation rules for data quality.

### List Validation Rules

```
GET /api/v1/validations
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| is_active | bool | Filter by active status |
| rule_type | string | Filter by type (sql, python_expr) |

**Response (200):**

```json
[
  {
    "id": "rule-uuid",
    "name": "LEI Format Check",
    "description": "Validates LEI is 20 alphanumeric characters",
    "rule_type": "python_expr",
    "expression": "len(lei) == 20 and lei.isalnum()",
    "severity": "blocking",
    "error_message": "Invalid LEI format",
    "is_active": true
  }
]
```

### Create Validation Rule

```
POST /api/v1/validations
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/validations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Price Positive",
    "description": "Ensure price is greater than zero",
    "rule_type": "python_expr",
    "expression": "price > 0",
    "severity": "blocking",
    "error_message": "Price must be positive",
    "is_active": true
  }'
```

**Severity Options:** `warning`, `blocking`, `correctable`

**Rule Types:**
- `python_expr` - Python expression evaluated per row
- `sql` - SQL query that returns failing rows

### Test Validation Rule

```
POST /api/v1/validations/{validation_id}/test
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/validations/rule-uuid/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sample_data": {
      "price": 100.50,
      "quantity": 1000
    }
  }'
```

**Response (200):**

```json
{
  "passed": true,
  "error_message": null,
  "execution_time_ms": 2
}
```

---

## Mappings

Manage cross-reference mapping sets.

### List Mapping Sets

```
GET /api/v1/mappings
```

**Response (200):**

```json
[
  {
    "id": "mapping-set-uuid",
    "name": "Country to ISO",
    "description": "Map country names to ISO codes",
    "entry_count": 250,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Create Mapping Set

```
POST /api/v1/mappings
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/mappings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trading Venue Codes",
    "description": "Map internal venue IDs to MIC codes"
  }'
```

### Create Mapping Entry

```
POST /api/v1/mappings/{set_id}/entries
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/mappings/set-uuid/entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source_value": "LSE",
    "target_value": "XLON",
    "effective_from": "2024-01-01",
    "effective_to": null
  }'
```

### Import from CSV

```
POST /api/v1/mappings/{set_id}/import
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/mappings/set-uuid/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@mappings.csv"
```

**CSV Format:**

```csv
source_value,target_value,effective_from,effective_to
LSE,XLON,2024-01-01,
NYSE,XNYS,2024-01-01,
```

**Response (200):**

```json
{
  "imported": 100,
  "errors": []
}
```

### Export to CSV

```
GET /api/v1/mappings/{set_id}/export
```

---

## Delivery

Manage artifact delivery to destinations.

### Trigger Manual Delivery

```
POST /api/v1/delivery/artifacts/{artifact_id}/deliver
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/delivery/artifacts/artifact-uuid/deliver \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destination_id": "destination-uuid"}'
```

**Response (200):**

```json
{
  "message": "Delivery queued",
  "artifact_id": "artifact-uuid",
  "destination_id": "destination-uuid",
  "destination_name": "Regulator SFTP"
}
```

### Get Artifact Delivery History

```
GET /api/v1/delivery/artifacts/{artifact_id}/deliveries
```

### Get Destination Delivery History

```
GET /api/v1/delivery/destinations/{destination_id}/deliveries
```

---

## Submissions

Track regulatory file submissions and responses.

### List File Submissions

```
GET /api/v1/submissions/files
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| business_date | date | Filter by business date |
| status | string | pending, submitted, accepted, rejected |

### Register Regulator Response

```
POST /api/v1/submissions/files/{file_id}/response
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/submissions/files/file-uuid/response \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "overall_status": "partial",
    "response_code": "PART_ACC",
    "rejections": [
      {"record_ref": "TXN-001", "code": "ERR001", "message": "Invalid LEI"}
    ]
  }'
```

### Amend Rejected Record

```
PUT /api/v1/submissions/records/{record_id}/amend
```

**Request:**

```bash
curl -X PUT http://localhost:8000/api/v1/submissions/records/record-uuid/amend \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amended_data": {"lei": "529900T8BM49AURSDO55"},
    "reason": "Corrected LEI format"
  }'
```

### Get Submission Statistics

```
GET /api/v1/submissions/stats
```

---

## Workflow

Monitor and control workflow execution.

### Get Workflow Status

```
GET /api/v1/workflow/runs/{job_run_id}/workflow
```

**Response (200):**

```json
{
  "id": "workflow-uuid",
  "job_run_id": "job-run-uuid",
  "workflow_name": "report_execution",
  "current_state": "transforming",
  "progress_percentage": 60,
  "started_at": "2024-01-20T00:00:00Z",
  "steps": [
    {"step_name": "initializing", "status": "completed", "duration_ms": 100},
    {"step_name": "fetching_data", "status": "completed", "duration_ms": 5000},
    {"step_name": "pre_validation", "status": "completed", "duration_ms": 2000},
    {"step_name": "transforming", "status": "running", "duration_ms": null}
  ]
}
```

### Get Workflow Progress (Lightweight)

For polling during execution.

```
GET /api/v1/workflow/runs/{job_run_id}/workflow/progress
```

**Response (200):**

```json
{
  "state": "transforming",
  "progress": 60,
  "current_step": "transforming",
  "is_complete": false
}
```

### Cancel Workflow

```
POST /api/v1/workflow/runs/{job_run_id}/workflow/cancel
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/workflow/runs/run-uuid/workflow/cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Data issue detected"}'
```

### Get Workflow Statistics

```
GET /api/v1/workflow/workflows/stats
```

---

## Webhooks

Configure event notifications.

### List Event Types

```
GET /api/v1/webhooks/events/types
```

**Response (200):**

```json
{
  "event_types": [
    {"value": "job.started", "description": "Fired when a report job begins execution"},
    {"value": "job.completed", "description": "Fired when a report job completes successfully"},
    {"value": "job.failed", "description": "Fired when a report job fails"},
    {"value": "artifact.created", "description": "Fired when a new artifact is generated"},
    {"value": "delivery.completed", "description": "Fired when an artifact is delivered"},
    {"value": "delivery.failed", "description": "Fired when artifact delivery fails"},
    {"value": "validation.failed", "description": "Fired when validation rules fail"}
  ]
}
```

### Create Webhook

```
POST /api/v1/webhooks
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Job Notifications",
    "url": "https://api.example.com/webhooks/openreg",
    "events": ["job.completed", "job.failed"],
    "timeout_seconds": 30
  }'
```

**Response (201):**

```json
{
  "webhook": {
    "id": "webhook-uuid",
    "name": "Job Notifications",
    "url": "https://api.example.com/webhooks/openreg",
    "events": ["job.completed", "job.failed"],
    "is_active": true
  },
  "secret": "whsec_abc123..."
}
```

**Important:** Save the secret! It's only shown once and used to verify webhook signatures.

### Test Webhook

```
POST /api/v1/webhooks/{webhook_id}/test
```

**Response (200):**

```json
{
  "success": true,
  "status_code": 200,
  "response_time_ms": 150
}
```

### Rotate Webhook Secret

```
POST /api/v1/webhooks/{webhook_id}/rotate-secret
```

### Retry Failed Delivery

```
POST /api/v1/webhooks/{webhook_id}/deliveries/{delivery_id}/retry
```

### Webhook Payload Format

```json
{
  "event": "job.completed",
  "timestamp": "2024-01-20T06:00:15Z",
  "tenant_id": "tenant-uuid",
  "data": {
    "job_run_id": "job-run-uuid",
    "report_id": "report-uuid",
    "report_name": "MiFIR Daily Transaction Report",
    "status": "success",
    "artifacts": [...]
  }
}
```

**Signature Verification:**

Webhooks are signed with HMAC-SHA256. Verify using:

```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str, timestamp: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        f"{timestamp}.{payload.decode()}".encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"v1={expected}", signature)
```

---

## API Keys

Manage programmatic access keys.

### Create API Key

```
POST /api/v1/api-keys
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "description": "Used for automated report triggering",
    "permissions": ["report:read", "report:execute"],
    "expires_in_days": 365,
    "rate_limit_per_minute": 100
  }'
```

**Response (201):**

```json
{
  "id": "key-uuid",
  "name": "CI/CD Pipeline",
  "key": "ork_abc123xyz...",
  "key_prefix": "ork_abc",
  "permissions": ["report:read", "report:execute"],
  "expires_at": "2025-01-20T00:00:00Z",
  "created_at": "2024-01-20T00:00:00Z"
}
```

**Important:** Save the full key! It's only shown once.

### Using API Keys

```bash
curl http://localhost:8000/api/v1/reports \
  -H "X-API-Key: ork_abc123xyz..."
```

### List API Keys

```
GET /api/v1/api-keys
```

### Rotate API Key

```
POST /api/v1/api-keys/{key_id}/rotate
```

### Revoke API Key

```
DELETE /api/v1/api-keys/{key_id}
```

---

## Admin

User and role management (requires admin privileges).

### List Users

```
GET /api/v1/admin/users
```

### Create User

```
POST /api/v1/admin/users
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@example.com",
    "password": "secure_password",
    "full_name": "Report Analyst",
    "role_id": "analyst-role-uuid"
  }'
```

### Update User

```
PUT /api/v1/admin/users/{user_id}
```

### Delete User

```
DELETE /api/v1/admin/users/{user_id}
```

### List Roles

```
GET /api/v1/admin/roles
```

### Create Role

```
POST /api/v1/admin/roles
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/admin/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Report Analyst",
    "description": "Can view and execute reports",
    "permissions": ["report:read", "report:execute", "run:read"]
  }'
```

### Get Audit Logs

```
GET /api/v1/admin/audit
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| entity_type | string | Filter by entity (Report, User, etc.) |
| action | string | Filter by action (create, update, delete) |
| user_id | UUID | Filter by user |
| from_date | datetime | Start date |
| to_date | datetime | End date |

### Get Tenant Settings

```
GET /api/v1/admin/settings
```

### Update Tenant Settings

```
PUT /api/v1/admin/settings
```

**Request:**

```bash
curl -X PUT http://localhost:8000/api/v1/admin/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_timeout_minutes": 60}'
```

### Switch Environment (Sandbox/Production)

```
PUT /api/v1/admin/tenant/environment
```

**Request:**

```bash
curl -X PUT http://localhost:8000/api/v1/admin/tenant/environment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"environment": "sandbox"}'
```

---

## Dashboard

Get summary statistics for the dashboard.

### Get Daily Summary

```
GET /api/v1/dashboard/daily-summary
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| business_date | date | Business date (default: previous business day) |

**Response (200):**

```json
{
  "business_date": "2024-01-19",
  "is_previous_business_date": true,
  "scheduled_reports": [
    {
      "report_name": "MiFIR Daily",
      "status": "success",
      "artifact_id": "artifact-uuid"
    }
  ],
  "submission_stats": {
    "total_records": 1000,
    "records_accepted": 995,
    "records_rejected": 5
  },
  "summary": {
    "total_scheduled": 5,
    "success": 4,
    "failed": 1
  }
}
```

### Get Previous Business Date

```
GET /api/v1/dashboard/previous-business-date
```

---

## External API

Sync with external regulatory APIs.

### List API Configurations

```
GET /api/v1/external-api/configs
```

### Create API Configuration

```
POST /api/v1/external-api/configs
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/external-api/configs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FCA Reporting API",
    "api_base_url": "https://api.fca.org.uk/v1",
    "auth_type": "api_key",
    "credentials": {"api_key": "your-api-key"},
    "sync_schedule": "0 2 * * *",
    "auto_sync_enabled": true
  }'
```

### Test API Connection

```
POST /api/v1/external-api/configs/{config_id}/test
```

### Trigger Sync

```
POST /api/v1/external-api/configs/{config_id}/sync
```

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/external-api/configs/config-uuid/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "differential"}'
```

### Get Sync Status

```
GET /api/v1/external-api/sync-status
```

### List Conflicts

```
GET /api/v1/external-api/conflicts
```

### Resolve Conflict

```
POST /api/v1/external-api/conflicts/{entity_type}/{entity_id}/resolve
```

---

## Complete Workflow Examples

### Example 1: Create and Execute a Report

```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# 1. Login
response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "admin@example.com",
    "password": "admin123"
})
token = response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Create a connector
response = requests.post(f"{BASE_URL}/connectors", headers=headers, json={
    "name": "Trading DB",
    "type": "postgresql",
    "config": {"host": "localhost", "port": 5432, "database": "trading"},
    "credentials": {"username": "user", "password": "pass"}
})
connector_id = response.json()["id"]

# 3. Create a report
response = requests.post(f"{BASE_URL}/reports", headers=headers, json={
    "name": "Daily Trades Report",
    "description": "Export daily trades"
})
report_id = response.json()["id"]

# 4. Create report version with code
response = requests.post(f"{BASE_URL}/reports/{report_id}/versions", headers=headers, json={
    "python_code": '''
def transform(db, mappings, params):
    query = "SELECT * FROM trades WHERE trade_date = :date"
    return db.execute(query, {"date": params.get("business_date")}).fetchall()
''',
    "connector_id": connector_id,
    "config": {"output_format": "xml"}
})

# 5. Execute the report
response = requests.post(f"{BASE_URL}/reports/{report_id}/execute", headers=headers, json={
    "parameters": {"business_date": "2024-01-19"}
})
job_run_id = response.json()["job_run_id"]

# 6. Poll for completion
import time
while True:
    response = requests.get(
        f"{BASE_URL}/workflow/runs/{job_run_id}/workflow/progress",
        headers=headers
    )
    progress = response.json()
    print(f"Progress: {progress['progress']}% - {progress['state']}")
    if progress["is_complete"]:
        break
    time.sleep(2)

# 7. Download artifact
response = requests.get(f"{BASE_URL}/runs/{job_run_id}/artifacts", headers=headers)
artifact_id = response.json()[0]["id"]

response = requests.get(
    f"{BASE_URL}/runs/{job_run_id}/artifacts/{artifact_id}/download",
    headers=headers
)
with open("report.xml", "wb") as f:
    f.write(response.content)

print("Report generated successfully!")
```

### Example 2: Setup Scheduled Delivery

```bash
# 1. Create destination
curl -X POST http://localhost:8000/api/v1/destinations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Regulator SFTP",
    "protocol": "sftp",
    "host": "sftp.regulator.eu",
    "port": 22,
    "username": "reporting",
    "password": "secure_pass",
    "directory": "/inbound"
  }'

# 2. Link destination to report
curl -X POST http://localhost:8000/api/v1/reports/REPORT_ID/destinations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destination_id": "DESTINATION_ID"}'

# 3. Create schedule
curl -X POST http://localhost:8000/api/v1/schedules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily at 6 AM",
    "report_id": "REPORT_ID",
    "schedule_type": "cron",
    "cron_expression": "0 6 * * *",
    "is_active": true
  }'
```

### Example 3: Webhook Integration

```python
from flask import Flask, request
import hmac
import hashlib

app = Flask(__name__)
WEBHOOK_SECRET = "whsec_your_secret"

@app.route("/webhook", methods=["POST"])
def handle_webhook():
    # Verify signature
    signature = request.headers.get("X-Webhook-Signature")
    timestamp = request.headers.get("X-Webhook-Timestamp")
    payload = request.data

    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        f"{timestamp}.{payload.decode()}".encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(f"v1={expected}", signature):
        return "Invalid signature", 401

    event = request.json

    if event["event"] == "job.completed":
        print(f"Report completed: {event['data']['report_name']}")
        # Process artifacts, send notifications, etc.
    elif event["event"] == "job.failed":
        print(f"Report failed: {event['data']['error_message']}")
        # Alert team, create ticket, etc.

    return "OK", 200
```

---

## Rate Limiting

API requests are rate-limited based on authentication method:

| Method | Default Limit |
|--------|---------------|
| JWT Auth | 1000 requests/minute |
| API Key | Configurable per key (default: 60/minute) |
| Unauthenticated | 20 requests/minute |

Rate limit headers in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1705743600
```

---

## Health Endpoints

Public endpoints (no auth required):

```
GET /health        # Liveness probe
GET /ready         # Readiness probe with dependency checks
```

---

## Related Documentation

- [Quick Start Guide](QUICKSTART.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [Security Guide](SECURITY.md)
- [Architecture](ARCHITECTURE.md)
