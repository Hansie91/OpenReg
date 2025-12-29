# User Guide

Welcome to OpenReg! This guide covers all features available in the web portal.

---

## Getting Started

### First Login

1. Navigate to your OpenReg portal URL (default: `http://localhost:3000`)
2. Enter your email and password
3. Default admin credentials: `admin@example.com` / `admin123`

> ⚠️ **Security**: Change the default password immediately after first login.

### Navigation

The sidebar provides access to all major features:

| Section | Description |
|---------|-------------|
| Dashboard | Overview statistics and quick actions |
| Reports | Create and manage report configurations |
| Connectors | Database connection settings |
| Mappings | Cross-reference lookup tables |
| Validations | Validation rules and testing |
| Schemas | XSD and JSON schema management |
| Schedules | Automated execution schedules |
| Destinations | SFTP/FTP delivery targets |
| Runs | Job execution history |
| Exceptions | Validation failure queue |
| Streaming | Real-time data processing |
| Admin | User management and settings |

---

## Dashboard

The dashboard provides an at-a-glance view of your reporting environment:

- **Total Reports**: Active report configurations
- **Recent Runs**: Latest job executions with status
- **Upcoming Schedules**: Next scheduled executions
- **Exception Count**: Pending validation failures

Click any statistic to navigate to the detailed view.

---

## Reports

Reports are the core of OpenReg. Each report defines how to extract data, transform it, and generate output files.

### Creating a Report

1. Click **+ New Report**
2. Enter:
   - **Name**: Descriptive report name
   - **Description**: Purpose and details
   - **Connector**: Data source connection
3. Click **Create**

### Report Versions

Reports use semantic versioning (Major.Minor.Patch):

| Version Type | When to Use |
|--------------|-------------|
| **Major** (2.0.0) | Breaking changes to output format |
| **Minor** (1.1.0) | New fields or features |
| **Patch** (1.0.1) | Bug fixes, no output changes |

**Version Status:**
- **Draft**: Under development, not executable
- **Active**: Production version (only one per report)
- **Archived**: Previous versions for reference

### Configuring a Report

Each report version contains:

#### Output Configuration
- **Output Format**: XML, JSON, CSV, or TXT
- **Filename Template**: Dynamic naming with tokens
  - `{report_name}`, `{business_date}`, `{timestamp}`
  - Example: `MiFIR_{business_date}.xml`

#### Source Query
Define the SQL query to extract data:
```sql
SELECT trade_id, counterparty, amount
FROM transactions
WHERE trade_date = :business_date
```

Use `:parameter_name` syntax for runtime parameters.

#### Field Mappings
Map source columns to output elements:
1. Click **Add Mapping**
2. Select source field (from query results)
3. Select target element (from schema or custom)
4. Configure transformations (optional)

#### Transformation Code
Write Python code to transform data:
```python
# Available: df (pandas DataFrame), parameters (dict)
df['amount_eur'] = df['amount'] * parameters.get('fx_rate', 1.0)
return df
```

**Allowed Libraries**: pandas, numpy, datetime, json, hashlib, lxml

### Executing a Report

1. Open the report
2. Click **Execute**
3. Configure parameters:
   - **Business Date**: Reporting date
   - **Custom Parameters**: Report-specific values
4. Click **Run Now**

View progress in the **Runs** section.

---

## Connectors

Connectors define connections to external databases for data extraction.

### Creating a Connector

1. Click **+ New Connector**
2. Select database type:
   - PostgreSQL
   - SQL Server
   - Oracle
   - MySQL
   - ODBC
3. Enter connection details:
   - Host, Port, Database
   - Username, Password
4. Click **Test Connection** to verify
5. Click **Save**

> 🔒 **Security**: Passwords are encrypted at rest using AES-256.

### Connection Pooling

Configure pool settings for high-volume environments:
- **Min Connections**: Minimum pool size
- **Max Connections**: Maximum pool size (default: 10)
- **Connection Timeout**: Query timeout in seconds

---

## Mappings

Cross-reference mappings translate values between systems (e.g., internal codes to regulatory codes).

### Creating a Mapping Set

1. Click **+ New Mapping Set**
2. Enter name and description
3. Define columns:
   - Source field name
   - Target field name
   - Effective date support (optional)

### Adding Entries

Add mappings individually or via CSV import:

| Source | Target | Effective From | Effective To |
|--------|--------|----------------|--------------|
| INT001 | EXT001 | 2025-01-01 | 2025-12-31 |

### Using Mappings in Reports

Reference mappings in transformation code:
```python
# Lookup counterparty code
df['lei'] = df['counterparty'].map(
    mappings['counterparty_lei']
)
```

---

## Validations

Validation rules ensure data quality before and after report generation.

### Rule Types

| Type | Description |
|------|-------------|
| **Pre-Generation** | Validate source data before transformation |
| **Pre-Delivery** | Validate output before sending to regulators |

### Severity Levels

| Severity | Effect |
|----------|--------|
| **Blocking** | Fails the entire record |
| **Warning** | Logged but record continues |
| **Correctable** | Allows manual correction in exceptions |

### Creating a Rule

1. Click **+ New Rule**
2. Configure:
   - **Name**: Rule identifier
   - **Phase**: Pre-generation or pre-delivery
   - **Severity**: Blocking, warning, or correctable
   - **Type**: SQL or Python expression
3. Write the validation logic:

**SQL Example:**
```sql
SELECT trade_id FROM trades WHERE amount IS NULL
-- Returns failing record IDs
```

**Python Example:**
```python
# Returns boolean (True = passes)
row['amount'] is not None and row['amount'] > 0
```

### Testing Rules

Click **Test** to validate sample data against your rule before activating.

---

## Schemas

Upload and manage XSD or JSON schemas that define report output structure.

### Uploading a Schema

1. Click **+ Upload Schema**
2. Select file (XSD or JSON Schema)
3. Enter name and version
4. Elements are automatically parsed for field mapping

### Viewing Schema Elements

After upload, browse the schema structure:
- Element names and paths
- Data types and constraints
- Required vs. optional fields

---

## Schedules

Automate report execution with cron expressions or calendar-based scheduling.

### Schedule Types

| Type | Use Case |
|------|----------|
| **Cron** | Fixed intervals (daily, weekly) |
| **Calendar** | Business day awareness, holidays |
| **Manual** | On-demand only |

### Creating a Schedule

1. Click **+ New Schedule**
2. Select report and version
3. Configure timing:
   - **Cron**: `0 18 * * 1-5` (weekdays at 6 PM)
   - **Calendar**: Business days, skip holidays
4. Set parameters for each run
5. Enable schedule

### Cron Expression Reference

```
┌──────────── minute (0-59)
│ ┌────────── hour (0-23)
│ │ ┌──────── day of month (1-31)
│ │ │ ┌────── month (1-12)
│ │ │ │ ┌──── day of week (0-6, Sun=0)
│ │ │ │ │
* * * * *
```

Common patterns:
- `0 6 * * *` — Daily at 6:00 AM
- `0 18 * * 1-5` — Weekdays at 6:00 PM
- `0 0 1 * *` — First day of each month

---

## Destinations

Configure SFTP/FTP servers for automated report delivery.

### Creating a Destination

1. Click **+ New Destination**
2. Select protocol: SFTP or FTP
3. Enter server details:
   - Host, Port
   - Username
   - Authentication: Password or SSH Key
   - Remote directory path
4. Click **Test Connection**
5. Save

### Delivery Settings

- **Retry Policy**: Attempts, backoff strategy
- **File Naming**: Override filename template
- **Post-Upload Action**: Delete local, move to archive

### Linking to Reports

In report configuration, assign destinations:
1. Edit report version
2. Add destination in **Delivery** tab
3. Configure conditions (always, on success only)

---

## Runs

Monitor job execution history and download generated artifacts.

### Run List

View all executions with:
- Status: Pending, Running, Success, Failed, Partial
- Duration
- Triggered by: Manual, Schedule, API

### Run Details

Click a run to see:
- **Timeline**: Created, started, ended times
- **Validation Results**: Pass/fail counts
- **Artifacts**: Download generated files
- **Logs**: Execution trace

### Downloading Artifacts

1. Open run details
2. Click **Download** on the artifact
3. Files are authenticated; no direct links

### Re-running a Job

Failed runs can be retried:
1. Open run details
2. Click **Re-run**
3. Optionally modify parameters

---

## Exceptions

Handle validation failures that require manual intervention.

### Exception Queue

Lists records that failed validations:
- Report and run reference
- Failing field and rule
- Original vs. expected value

### Resolving Exceptions

1. Click exception to view details
2. Choose action:
   - **Amend**: Correct the value
   - **Reject**: Exclude from submission
   - **Resubmit**: Retry with corrections
3. Save changes

### Bulk Actions

Select multiple exceptions for bulk:
- Approve all
- Reject all
- Export to CSV

---

## Streaming

Real-time data processing for continuous reporting (MiFIR/EMIR intraday).

### Stream Configuration

1. Create stream linked to report
2. Configure source:
   - Polling interval
   - Watermark field (for incremental)
3. Define batch settings:
   - Batch size
   - Aggregation window

### Monitoring Streams

View active streams with:
- Records processed
- Last batch time
- Error counts

---

## Admin

Administrative functions for users, roles, and system settings.

### Users

| Action | Description |
|--------|-------------|
| Create | Add new user with email/password |
| Edit | Modify name, email, status |
| Assign Roles | Grant role memberships |
| Disable | Deactivate without deletion |

### Roles

Default roles:
- **Administrator**: Full access
- **Report Manager**: Create/edit/run reports
- **Report Viewer**: Read-only access

Custom roles can be created with specific permissions.

### Settings

| Setting | Description |
|---------|-------------|
| Session Timeout | Auto-logout after inactivity (minutes) |
| Password Policy | Minimum length, complexity |
| Audit Retention | How long to keep audit logs |

### Audit Log

View all system activity:
- User actions (login, changes)
- Report executions
- Configuration modifications

Filter by date, user, action type, or entity.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Quick search |
| `Esc` | Close modal |
| `Enter` | Submit form |

---

## Getting Help

- **API Documentation**: `/docs` (OpenAPI UI)
- **FAQ**: See [FAQ.md](./FAQ.md)
- **Community**: GitHub Issues & Discussions
- **Security Issues**: security@openreg.io

---

## Related Documentation

- [Architecture Guide](./ARCHITECTURE.md) — Technical design
- [Deployment Guide](./DEPLOYMENT.md) — Production setup
- [Security Model](./SECURITY.md) — Security features
