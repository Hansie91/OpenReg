# OpenReg Project Guidelines

## Packaged Report Templates

### MANDATORY: All packaged regulatory reports MUST include proper XML headers

Every packaged report template in `backend/templates/regulatory/` MUST include:

1. **XML Configuration** with:
   - `message_type`: The ISO 20022 auth message code (e.g., auth.016, auth.030, auth.052)
   - `namespace`: Full ISO 20022 namespace URI
   - `header`: Configuration for regulatory-required header elements
   - `pretty_print: true`
   - `include_declaration: true`

2. **CDM Query** (`query_sql`):
   - Must query from CDM views (e.g., `vw_cdm_trade_data`)
   - Must use `{business_date_from}` parameter for date filtering
   - No external connector required - queries internal database

3. **Filename Template**:
   - Format: `{REGULATION}_{business_date_from}_{job_run_id}`
   - Example: `MIFIR_{business_date_from}_{job_run_id}`

### Supported Regulations and Message Types

| Regulation | Message Type | Wrapper Element | Row Element | Header Type |
|------------|--------------|-----------------|-------------|-------------|
| MiFIR | auth.016 | FinInstrmRptgTxRpt | Tx | RptHdr |
| MiFIR Status | auth.017 | FinInstrmRptgTxRptStsAdvc | TxStsAdvc | RptHdr |
| MiFIR RefData | auth.040 | FinInstrmRptgRefDataRpt | RefData | RptHdr |
| EMIR | auth.030 | DerivsTradRpt | Trade | TxHdr |
| EMIR Query | auth.031 | DerivsTradRptQry | Qry | TxHdr |
| SFTR | auth.052 | SctiesFincgRptgTxRpt | SFT | RptHdr |
| SFTR Status | auth.053 | SctiesFincgRptgTxStsAdvc | TxSts | RptHdr |

### Header Fields by Regulation

**MiFIR (RptHdr):**
- `RptgDt` - Reporting date
- `NbRcrds` - Number of records
- `RptgPty/LEI` - Reporting party LEI
- `CmptntAuthrty/Ctry` - Competent authority country code

**EMIR (TxHdr):**
- `MsgId` - Unique message ID
- `CreDtTm` - Creation datetime
- `NbOfTxs` - Number of transactions
- `RptgCtrPty/LEI` - Reporting counterparty LEI
- `RptSubmitgNtty/LEI` - Report submitting entity LEI
- `TradRpstry/LEI` - Trade repository LEI

**SFTR (RptHdr):**
- `MsgId` - Unique message ID
- `CreDtTm` - Creation datetime
- `NbOfTxs` - Number of transactions
- `RptgCtrPty/LEI` - Reporting counterparty LEI
- `RptSubmitgNtty/LEI` - Report submitting entity LEI
- `TradRpstry/LEI` - Trade repository LEI

### Template Structure Example

```json
{
  "id": "regulation-report-v1",
  "name": "Regulation Report Name",
  "regulation": "REGULATION",
  "config": {
    "output_format": "xml",
    "output_filename_template": "REGULATION_{business_date_from}_{job_run_id}",
    "query_sql": "SELECT * FROM vw_cdm_xxx_data WHERE trade_date = '{business_date_from}'::date",
    "xml": {
      "pretty_print": true,
      "include_declaration": true,
      "row_element": "ElementName",
      "header": {
        "message_type": "auth.XXX",
        "namespace": "urn:iso:std:iso:20022:tech:xsd:auth.XXX.001.01",
        "include_record_count": true,
        "reporting_party_lei": "",
        "...other required fields..."
      }
    },
    "field_mappings": [...]
  }
}
```

## Architecture Notes

### CDM (Common Data Model)
- Packaged reports query CDM views, not external connectors
- `connector_id = NULL` for packaged reports
- Internal database queries via SQLAlchemy

### Data Flow
```
Source Systems → Connectors → CDM Tables → Packaged Reports
                              (canonical_*)
                              (vw_cdm_*)
```
