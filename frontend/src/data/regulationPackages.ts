/**
 * Regulation Packages - Open Source Core
 *
 * Pre-built regulation packages for EMIR, MiFIR, and SFTR.
 * These are bundled with the frontend and available without API access.
 *
 * CDM (Common Domain Model) paths follow the ISDA/FINOS CDM standard.
 * See: https://cdm.finos.org/
 *
 * The optional API provides:
 * - Live validation against CDM data
 * - Projection to regulatory formats
 * - Report generation
 */

export interface FieldSpec {
  field_id: string;
  field_name: string;
  description: string;
  data_type: string;
  requirement: 'mandatory' | 'conditional' | 'optional';
  max_length?: number;
  min_length?: number;
  pattern?: string;
  enum_values?: string[];
  condition?: string;  // Human-readable condition description
  // Structured condition expression for programmatic evaluation
  // Examples:
  //   { field: 'action_type', operator: 'in', value: ['MODI', 'CORR', 'TERM'] }
  //   { field: 'asset_class', operator: 'eq', value: 'IR' }
  //   { field: 'branch_country', operator: 'exists' }
  //   { or: [{ field: 'x', operator: 'eq', value: 'A' }, { field: 'y', operator: 'eq', value: 'B' }] }
  condition_expr?: ConditionExpression;
  cdm_path?: string;  // Path in the ISDA Common Domain Model (CDM)
  transform?: string;
  default_value?: string;
  xml_element?: string;
  validation_rules: string[];
  // For multi-report-type regulations: which report types this field applies to
  report_types?: string[];
}

// Structured condition expressions for conditional fields
export type ConditionExpression =
  | { field: string; operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'; value: string | number }
  | { field: string; operator: 'in' | 'not_in'; value: (string | number)[] }
  | { field: string; operator: 'exists' | 'not_exists' }
  | { field: string; operator: 'matches'; value: string }  // regex
  | { and: ConditionExpression[] }
  | { or: ConditionExpression[] }
  | { not: ConditionExpression };

export interface ReportTypeSpec {
  code: string;
  name: string;
  description: string;
  action_types: string[];  // e.g., ['NEWT', 'MODI', 'CORR', 'TERM'] for trade reports
  field_count: number;
}

export interface ValidationRuleSpec {
  rule_id: string;
  name: string;
  description: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  rule_type: string;
  expression: string;
  error_message: string;
  affected_fields: string[];
}

export interface RegulationPackage {
  package_id: string;
  regulation_code: string;
  regulation_name: string;
  version: string;
  effective_date: string;
  description: string;
  jurisdiction: string;
  reporting_authority: string;
  field_count: number;
  mandatory_fields: number;
  conditional_fields: number;
  optional_fields: number;
  validation_rule_count: number;
  output_format: string;
  output_schema?: string;
  output_namespace?: string;
  output_root_element?: string;
  tags: string[];
  // For regulations with multiple report types (e.g., EMIR: Trade, Position, Valuation, Margin)
  report_types?: ReportTypeSpec[];
  fields: FieldSpec[];
  validation_rules: ValidationRuleSpec[];
}

// =============================================================================
// EMIR REFIT Package - Complete 203 Fields
// =============================================================================
export const EMIR_PACKAGE: RegulationPackage = {
  package_id: 'emir-refit-2024',
  regulation_code: 'EMIR',
  regulation_name: 'European Market Infrastructure Regulation REFIT',
  version: 'REFIT 3.0',
  effective_date: '2024-04-29',
  description: 'EMIR REFIT reporting requirements for OTC derivatives transactions. Complete 203 reportable fields across 4 report types: Trade State, Position, Valuation, and Margin reports.',
  jurisdiction: 'EU',
  reporting_authority: 'ESMA',
  field_count: 203,
  mandatory_fields: 128,
  conditional_fields: 62,
  optional_fields: 13,
  validation_rule_count: 45,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:iso:std:iso:20022:tech:xsd:auth.030.001.03',
  output_root_element: 'Document',
  tags: ['derivatives', 'OTC', 'trade-reporting', 'ESMA', 'EU', 'clearing', 'collateral'],
  report_types: [
    {
      code: 'TRADE',
      name: 'Trade State Report',
      description: 'Report new trades, modifications, corrections, and terminations of OTC derivatives',
      action_types: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR', 'REVI'],
      field_count: 75
    },
    {
      code: 'POSITION',
      name: 'Position Report',
      description: 'Daily outstanding positions for OTC derivatives with netting agreements',
      action_types: ['POSC'],
      field_count: 52
    },
    {
      code: 'VALUATION',
      name: 'Valuation Report',
      description: 'Daily mark-to-market or mark-to-model valuations',
      action_types: ['VALU'],
      field_count: 18
    },
    {
      code: 'MARGIN',
      name: 'Margin Report',
      description: 'Collateral and margin data for non-centrally cleared derivatives',
      action_types: ['MARU'],
      field_count: 22
    }
  ],
  fields: [
    // =========================================================================
    // TABLE 1: COUNTERPARTY DATA (Fields 1-49)
    // =========================================================================
    {
      field_id: 'EMIR_001',
      field_name: 'Report Submitting Entity ID',
      description: 'LEI of the entity submitting the report',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'trade_event.report_submitting_entity.lei',
      xml_element: 'RptSubmitgNtty',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_002',
      field_name: 'Reporting Counterparty ID',
      description: 'LEI of the reporting counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgCtrPty',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_003',
      field_name: 'Nature of Reporting Counterparty',
      description: 'Whether the reporting counterparty is a financial or non-financial counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['F', 'N'],
      cdm_path: 'parties[role=REPORTING].is_financial_counterparty',
      transform: 'BOOL_TO_F_N',
      xml_element: 'NtrRptgCtrPty',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_004',
      field_name: 'Sector of Reporting Counterparty',
      description: 'Corporate sector for financial counterparties',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required when Nature = F (financial)',
      enum_values: ['AIFD', 'CDTI', 'INUN', 'ORPI', 'INVF', 'UCIT', 'ASSU', 'REIN', 'CSDS', 'CCPS'],
      cdm_path: 'parties[role=REPORTING].sector',
      xml_element: 'SctrRptgCtrPty',
      validation_rules: ['ENUM_VALUE', 'REQUIRED_IF_FINANCIAL'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_005',
      field_name: 'Additional Sector Classification',
      description: 'Additional sector classification for specific types',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for AIFD and INVF sectors',
      enum_values: ['ETFT', 'MMFT', 'REIT', 'OTHR'],
      cdm_path: 'parties[role=REPORTING].additional_sector',
      xml_element: 'AddtlSctrClssfctn',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_006',
      field_name: 'Reporting Counterparty Branch',
      description: 'Country code of the branch that concluded the trade',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      condition: 'Required when transaction concluded by a branch',
      condition_expr: { field: 'parties[role=REPORTING].branch_country', operator: 'exists' },
      cdm_path: 'parties[role=REPORTING].branch_country',
      xml_element: 'RptgCtrPtyBrnch',
      validation_rules: ['ISO_COUNTRY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_007',
      field_name: 'Counterparty Side',
      description: 'Identifies whether the reporting counterparty is buyer or seller',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['BYER', 'SLLR'],
      cdm_path: 'parties[role=REPORTING].side',
      xml_element: 'CtrPtySd',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_008',
      field_name: 'Entity Responsible for Reporting',
      description: 'LEI of entity responsible for reporting',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required when different from reporting counterparty',
      cdm_path: 'trade_event.entity_responsible_for_reporting.lei',
      xml_element: 'NttyRspnsblForRpt',
      validation_rules: ['LEI_FORMAT'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_009',
      field_name: 'Other Counterparty ID',
      description: 'LEI of the other counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'OthrCtrPty',
      validation_rules: ['LEI_FORMAT'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_010',
      field_name: 'Country of Other Counterparty',
      description: 'Country code where other counterparty is domiciled',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      cdm_path: 'parties[role=OTHER].country_of_domicile',
      xml_element: 'CtryOthrCtrPty',
      validation_rules: ['ISO_COUNTRY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_011',
      field_name: 'Other Counterparty Branch',
      description: 'Country of the branch of other counterparty',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      condition: 'Required when transaction concluded by a branch',
      cdm_path: 'parties[role=OTHER].branch_country',
      xml_element: 'OthrCtrPtyBrnch',
      validation_rules: ['ISO_COUNTRY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_012',
      field_name: 'Beneficiary ID',
      description: 'LEI of the beneficiary of the contract',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required when beneficiary is different from reporting counterparty',
      cdm_path: 'parties[role=BENEFICIARY].lei',
      xml_element: 'Bnfcry',
      validation_rules: ['LEI_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_013',
      field_name: 'Trading Capacity',
      description: 'Whether counterparty traded as principal or agent',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['DEAL', 'APTS'],
      cdm_path: 'execution.trading_capacity',
      xml_element: 'TradgCpcty',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_014',
      field_name: 'Report Tracking Number',
      description: 'Unique identifier for the report submission',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      cdm_path: 'trade_event.report_tracking_number',
      xml_element: 'RptTrckgNb',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    // =========================================================================
    // TABLE 2: TRANSACTION DATA (Fields 15-100)
    // =========================================================================
    {
      field_id: 'EMIR_015',
      field_name: 'UTI',
      description: 'Unique Transaction Identifier per ISO 23897',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      pattern: '^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      cdm_path: 'trade_event.uti',
      xml_element: 'UnqTxIdr',
      validation_rules: ['UTI_FORMAT'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_016',
      field_name: 'Prior UTI',
      description: 'UTI of the predecessor transaction',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 52,
      condition: 'Required for lifecycle events (MODI, CORR, TERM)',
      condition_expr: { field: 'action_type', operator: 'in', value: ['MODI', 'CORR', 'TERM'] },
      cdm_path: 'trade_event.prior_uti',
      xml_element: 'PrrUnqTxIdr',
      validation_rules: ['UTI_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_017',
      field_name: 'Subsequent Position UTI',
      description: 'UTI of the position resulting from this trade',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 52,
      condition: 'Required when trade feeds into position',
      cdm_path: 'trade_event.subsequent_position_uti',
      xml_element: 'SbsqntPstnUTI',
      validation_rules: ['UTI_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_018',
      field_name: 'Action Type',
      description: 'Type of action being reported',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR', 'REVI', 'VALU', 'MARU', 'POSC'],
      cdm_path: 'trade_event.action_type',
      xml_element: 'Actn',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_019',
      field_name: 'Event Type',
      description: 'Type of event triggering the report',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['TRADE', 'NOVA', 'COMP', 'ETRM', 'CLRG', 'EXER', 'ALOC', 'CORP', 'INCP', 'UPDT', 'PTRR'],
      cdm_path: 'trade_event.event_type',
      xml_element: 'EvtTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_020',
      field_name: 'Event Date',
      description: 'Date of the reportable event',
      data_type: 'date',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      cdm_path: 'trade_event.event_date',
      xml_element: 'EvtDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_021',
      field_name: 'Reporting Timestamp',
      description: 'Date and time of report submission',
      data_type: 'datetime',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$',
      cdm_path: 'trade_event.reporting_timestamp',
      xml_element: 'RptgTmStmp',
      validation_rules: ['DATETIME_FORMAT'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_022',
      field_name: 'Execution Timestamp',
      description: 'Date and time of trade execution',
      data_type: 'datetime',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$',
      cdm_path: 'trade_event.execution_timestamp',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['DATETIME_FORMAT', 'NOT_FUTURE'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_023',
      field_name: 'Effective Date',
      description: 'Date the contract becomes effective',
      data_type: 'date',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      cdm_path: 'trade_event.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_024',
      field_name: 'Expiration Date',
      description: 'Original expiration date of the contract',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required unless open-ended',
      cdm_path: 'trade_event.expiration_date',
      xml_element: 'XprtnDt',
      validation_rules: ['DATE_FORMAT', 'AFTER_EFFECTIVE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_025',
      field_name: 'Early Termination Date',
      description: 'Date of early termination if applicable',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required when contract is terminated early',
      cdm_path: 'trade_event.early_termination_date',
      xml_element: 'EarlyTrmntnDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_026',
      field_name: 'Final Contractual Settlement Date',
      description: 'Date of final settlement',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      cdm_path: 'trade_event.final_settlement_date',
      xml_element: 'FnlCtrctlSttlmDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_027',
      field_name: 'Master Agreement Type',
      description: 'Type of master agreement governing the contract',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['ISDA', 'CMOF', 'EFMA', 'DERV', 'GMRA', 'GMSF', 'OTHR'],
      cdm_path: 'trade_event.master_agreement_type',
      xml_element: 'MstrAgrmtTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_028',
      field_name: 'Master Agreement Version',
      description: 'Year of the master agreement version',
      data_type: 'integer',
      requirement: 'conditional',
      condition: 'Required when Master Agreement Type is provided',
      cdm_path: 'trade_event.master_agreement_version',
      xml_element: 'MstrAgrmtVrsn',
      validation_rules: ['YEAR_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_029',
      field_name: 'Intragroup',
      description: 'Whether the transaction is intragroup',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.is_intragroup',
      xml_element: 'IntrGrp',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_030',
      field_name: 'PTRR',
      description: 'Post-trade risk reduction indicator',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.is_ptrr',
      xml_element: 'PTRR',
      validation_rules: [],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_031',
      field_name: 'PTRR Type',
      description: 'Type of post-trade risk reduction',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required when PTRR is true',
      enum_values: ['CMPR', 'REBL', 'CRSS', 'OTHR'],
      cdm_path: 'trade_event.ptrr_type',
      xml_element: 'PTRRTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE']
    },
    // =========================================================================
    // TABLE 2 CONTINUED: PRODUCT IDENTIFICATION (Fields 32-60)
    // =========================================================================
    {
      field_id: 'EMIR_032',
      field_name: 'UPI',
      description: 'Unique Product Identifier per ISO 4914',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      pattern: '^[A-Z0-9]{12}$',
      cdm_path: 'product.upi',
      xml_element: 'UPI',
      validation_rules: ['UPI_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_033',
      field_name: 'ISIN',
      description: 'ISIN of the underlying or contract',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 12,
      pattern: '^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      condition: 'Required when available',
      cdm_path: 'product.isin',
      xml_element: 'ISIN',
      validation_rules: ['ISIN_FORMAT', 'ISIN_CHECKSUM'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_034',
      field_name: 'CFI Code',
      description: 'Classification of Financial Instrument code',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 6,
      pattern: '^[A-Z]{6}$',
      cdm_path: 'product.cfi_code',
      xml_element: 'CFI',
      validation_rules: ['CFI_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_035',
      field_name: 'Asset Class',
      description: 'Asset class of the derivative',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['INTR', 'CRDT', 'CURR', 'EQUI', 'COMM'],
      cdm_path: 'product.asset_class',
      xml_element: 'AsstClss',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_036',
      field_name: 'Contract Type',
      description: 'Type of derivative contract',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['SWAP', 'FRAS', 'FUTR', 'OPTN', 'SWPT', 'CFDS', 'FXFW', 'FXOP', 'FXSW', 'FXND', 'OTHR'],
      cdm_path: 'product.product_type',
      xml_element: 'CtrctTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_037',
      field_name: 'Contract Sub-Type',
      description: 'Sub-type of derivative contract',
      data_type: 'string',
      requirement: 'conditional',
      cdm_path: 'product.product_sub_type',
      xml_element: 'CtrctSubTp',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    // =========================================================================
    // NOTIONAL & QUANTITY (Fields 38-55)
    // =========================================================================
    {
      field_id: 'EMIR_038',
      field_name: 'Notional Amount',
      description: 'Notional amount of the contract',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.notional_amount',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'NtnlAmt',
      validation_rules: ['POSITIVE_NUMBER'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_039',
      field_name: 'Notional Currency',
      description: 'Currency of the notional amount',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_040',
      field_name: 'Notional Amount Leg 2',
      description: 'Notional amount for the second leg',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for multi-leg derivatives',
      cdm_path: 'product.notional_amount_leg2',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'NtnlAmtLeg2',
      validation_rules: ['POSITIVE_NUMBER'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_041',
      field_name: 'Notional Currency Leg 2',
      description: 'Currency for the second leg notional',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when Notional Amount Leg 2 is provided',
      cdm_path: 'product.notional_currency_leg2',
      xml_element: 'NtnlCcyLeg2',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_042',
      field_name: 'Total Notional Quantity',
      description: 'Total quantity of the underlying',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for commodity and equity derivatives',
      cdm_path: 'product.total_notional_quantity',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'TtlNtnlQty',
      validation_rules: ['POSITIVE_NUMBER'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_043',
      field_name: 'Quantity Unit',
      description: 'Unit of the quantity',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required when Total Notional Quantity is provided',
      cdm_path: 'product.quantity_unit',
      xml_element: 'QtyUnit',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    // =========================================================================
    // PRICE & RATES (Fields 44-65)
    // =========================================================================
    {
      field_id: 'EMIR_044',
      field_name: 'Price',
      description: 'Price of the contract',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for relevant contract types',
      cdm_path: 'product.price',
      transform: 'FORMAT_DECIMAL_18_13',
      xml_element: 'Pric',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_045',
      field_name: 'Price Currency',
      description: 'Currency of the price',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when price is reported',
      cdm_path: 'product.price_currency',
      xml_element: 'PricCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_046',
      field_name: 'Price Notation',
      description: 'Manner in which the price is expressed',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['MONE', 'PERC', 'YIEL', 'BAPO'],
      cdm_path: 'product.price_notation',
      xml_element: 'PricNtn',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_047',
      field_name: 'Spread',
      description: 'Spread of floating rate leg',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for floating rate instruments',
      cdm_path: 'product.spread',
      transform: 'FORMAT_DECIMAL_18_17',
      xml_element: 'Sprd',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_048',
      field_name: 'Fixed Rate Leg 1',
      description: 'Fixed rate for the first leg',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for interest rate derivatives',
      cdm_path: 'product.fixed_rate_leg1',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'FxdRateLeg1',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_049',
      field_name: 'Fixed Rate Leg 2',
      description: 'Fixed rate for the second leg',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for fixed-fixed swaps',
      cdm_path: 'product.fixed_rate_leg2',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'FxdRateLeg2',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_050',
      field_name: 'Floating Rate Index Leg 1',
      description: 'Identifier for floating rate index leg 1',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for floating rate legs',
      cdm_path: 'product.floating_rate_index_leg1',
      xml_element: 'FltgRateIndxLeg1',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_051',
      field_name: 'Floating Rate Reference Period Leg 1',
      description: 'Reference period for floating rate leg 1',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DAIL', 'WEEK', 'MNTH', 'YEAR', 'TERM'],
      cdm_path: 'product.floating_rate_reference_period_leg1',
      xml_element: 'FltgRateRefPrdLeg1',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_052',
      field_name: 'Floating Rate Reference Period Multiplier Leg 1',
      description: 'Multiplier for floating rate reference period leg 1',
      data_type: 'integer',
      requirement: 'conditional',
      condition: 'Required for floating rate instruments',
      cdm_path: 'product.floating_rate_reference_period_multiplier_leg1',
      xml_element: 'FltgRateRefPrdMltplrLeg1',
      validation_rules: ['POSITIVE_INTEGER'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_053',
      field_name: 'Floating Rate Index Leg 2',
      description: 'Identifier for floating rate index leg 2',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for basis swaps',
      cdm_path: 'product.floating_rate_index_leg2',
      xml_element: 'FltgRateIndxLeg2',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_054',
      field_name: 'Floating Rate Reference Period Leg 2',
      description: 'Reference period for floating rate leg 2',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DAIL', 'WEEK', 'MNTH', 'YEAR', 'TERM'],
      cdm_path: 'product.floating_rate_reference_period_leg2',
      xml_element: 'FltgRateRefPrdLeg2',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_055',
      field_name: 'Floating Rate Reference Period Multiplier Leg 2',
      description: 'Multiplier for floating rate reference period leg 2',
      data_type: 'integer',
      requirement: 'conditional',
      condition: 'Required for basis swaps',
      cdm_path: 'product.floating_rate_reference_period_multiplier_leg2',
      xml_element: 'FltgRateRefPrdMltplrLeg2',
      validation_rules: ['POSITIVE_INTEGER'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_056',
      field_name: 'Spread Leg 1',
      description: 'Spread over the floating rate index leg 1',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for floating rate instruments',
      cdm_path: 'product.spread_leg1',
      transform: 'FORMAT_DECIMAL_18_17',
      xml_element: 'SprdLeg1',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_057',
      field_name: 'Spread Leg 2',
      description: 'Spread over the floating rate index leg 2',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for basis swaps',
      cdm_path: 'product.spread_leg2',
      transform: 'FORMAT_DECIMAL_18_17',
      xml_element: 'SprdLeg2',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_058',
      field_name: 'Spread Currency Leg 1',
      description: 'Currency of the spread leg 1',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.spread_currency_leg1',
      xml_element: 'SprdCcyLeg1',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_059',
      field_name: 'Spread Currency Leg 2',
      description: 'Currency of the spread leg 2',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.spread_currency_leg2',
      xml_element: 'SprdCcyLeg2',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_060',
      field_name: 'Day Count Fraction Leg 1',
      description: 'Day count fraction for leg 1',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A007', 'A008', 'A009', 'A010', 'A011', 'A012', 'A013', 'A014', 'NARR'],
      cdm_path: 'product.day_count_fraction_leg1',
      xml_element: 'DayCntFrctnLeg1',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_061',
      field_name: 'Day Count Fraction Leg 2',
      description: 'Day count fraction for leg 2',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A007', 'A008', 'A009', 'A010', 'A011', 'A012', 'A013', 'A014', 'NARR'],
      cdm_path: 'product.day_count_fraction_leg2',
      xml_element: 'DayCntFrctnLeg2',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_062',
      field_name: 'Payment Frequency Period Leg 1',
      description: 'Payment frequency period for leg 1',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DAIL', 'WEEK', 'MNTH', 'YEAR', 'ADHO', 'EXPI'],
      cdm_path: 'product.payment_frequency_period_leg1',
      xml_element: 'PmtFrqcyPrdLeg1',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_063',
      field_name: 'Payment Frequency Period Multiplier Leg 1',
      description: 'Multiplier for payment frequency leg 1',
      data_type: 'integer',
      requirement: 'conditional',
      cdm_path: 'product.payment_frequency_multiplier_leg1',
      xml_element: 'PmtFrqcyMltplrLeg1',
      validation_rules: ['POSITIVE_INTEGER'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_064',
      field_name: 'Payment Frequency Period Leg 2',
      description: 'Payment frequency period for leg 2',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DAIL', 'WEEK', 'MNTH', 'YEAR', 'ADHO', 'EXPI'],
      cdm_path: 'product.payment_frequency_period_leg2',
      xml_element: 'PmtFrqcyPrdLeg2',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_065',
      field_name: 'Payment Frequency Period Multiplier Leg 2',
      description: 'Multiplier for payment frequency leg 2',
      data_type: 'integer',
      requirement: 'conditional',
      cdm_path: 'product.payment_frequency_multiplier_leg2',
      xml_element: 'PmtFrqcyMltplrLeg2',
      validation_rules: ['POSITIVE_INTEGER'],
      report_types: ['TRADE', 'POSITION']
    },
    // =========================================================================
    // CLEARING & EXECUTION (Fields 66-85)
    // =========================================================================
    {
      field_id: 'EMIR_066',
      field_name: 'Cleared',
      description: 'Whether the contract is centrally cleared',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['Y', 'N'],
      cdm_path: 'trade_event.is_cleared',
      xml_element: 'Clrd',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_067',
      field_name: 'Clearing Timestamp',
      description: 'Timestamp when the contract was cleared',
      data_type: 'datetime',
      requirement: 'conditional',
      condition: 'Required when contract is cleared',
      cdm_path: 'trade_event.clearing_timestamp',
      xml_element: 'ClrgTmStmp',
      validation_rules: ['DATETIME_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_068',
      field_name: 'CCP',
      description: 'LEI of the central counterparty',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required when contract is cleared',
      cdm_path: 'trade_event.ccp_lei',
      xml_element: 'CCP',
      validation_rules: ['LEI_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_069',
      field_name: 'Clearing Member',
      description: 'LEI of the clearing member',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required when contract is cleared',
      cdm_path: 'parties[role=CLEARING_MEMBER].lei',
      xml_element: 'ClrMmb',
      validation_rules: ['LEI_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_070',
      field_name: 'Clearing Obligation',
      description: 'Whether contract is subject to clearing obligation',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['Y', 'N'],
      cdm_path: 'trade_event.clearing_obligation',
      xml_element: 'ClrOblgtn',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_071',
      field_name: 'Venue of Execution',
      description: 'MIC of the execution venue or XOFF/XXXX',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 4,
      pattern: '^[A-Z0-9]{4}$',
      cdm_path: 'execution.trading_venue_mic',
      xml_element: 'ExctnVn',
      validation_rules: ['MIC_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_072',
      field_name: 'Compression',
      description: 'Whether contract results from compression exercise',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.is_compressed',
      xml_element: 'Cmprssn',
      validation_rules: [],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_073',
      field_name: 'Counterparty Rating Trigger Indicator',
      description: 'Indicator for counterparty rating triggers',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.counterparty_rating_trigger',
      xml_element: 'CtrPtyRtgTrggrInd',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_074',
      field_name: 'Counterparty Rating Threshold Indicator',
      description: 'Indicator for counterparty rating thresholds',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.counterparty_rating_threshold',
      xml_element: 'CtrPtyRtgThrshldInd',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_075',
      field_name: 'Documentation Type',
      description: 'Type of documentation governing the contract',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['ISDA', 'CMOF', 'EFMA', 'DERV', 'GMRA', 'GMSF', 'OTHR'],
      cdm_path: 'trade_event.documentation_type',
      xml_element: 'DcmnttnTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_076',
      field_name: 'Documentation Version Year',
      description: 'Year of the documentation version',
      data_type: 'integer',
      requirement: 'conditional',
      condition: 'Required when Documentation Type is provided',
      cdm_path: 'trade_event.documentation_version_year',
      xml_element: 'DcmnttnVrsnYr',
      validation_rules: ['YEAR_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_077',
      field_name: 'Confirmation Platform',
      description: 'Platform used for trade confirmation',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 4,
      pattern: '^[A-Z0-9]{4}$',
      cdm_path: 'trade_event.confirmation_platform',
      xml_element: 'CnfrmtnPltfrm',
      validation_rules: ['MIC_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_078',
      field_name: 'Risk Mitigation Confirmation',
      description: 'Whether risk mitigation techniques applied for uncleared',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.risk_mitigation_confirmation',
      xml_element: 'RskMtgtnCnfrmtn',
      validation_rules: [],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_079',
      field_name: 'Risk Mitigation Confirmation Date',
      description: 'Date of risk mitigation confirmation',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required when Risk Mitigation Confirmation is true',
      cdm_path: 'trade_event.risk_mitigation_confirmation_date',
      xml_element: 'RskMtgtnCnfrmtnDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_080',
      field_name: 'Risk Mitigation Portfolio Reconciliation',
      description: 'Whether portfolio reconciliation performed',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.risk_mitigation_portfolio_reconciliation',
      xml_element: 'RskMtgtnPrtflRcncltn',
      validation_rules: [],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_081',
      field_name: 'Risk Mitigation Dispute Resolution',
      description: 'Whether dispute resolution procedures in place',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.risk_mitigation_dispute_resolution',
      xml_element: 'RskMtgtnDsptRsltn',
      validation_rules: [],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_082',
      field_name: 'Package Identifier',
      description: 'Identifier for package transactions',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 35,
      condition: 'Required for package transactions',
      cdm_path: 'trade_event.package_identifier',
      xml_element: 'PckgIdr',
      validation_rules: [],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_083',
      field_name: 'Package Transaction Price',
      description: 'Price of the package transaction',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for package transactions',
      cdm_path: 'trade_event.package_transaction_price',
      transform: 'FORMAT_DECIMAL_18_13',
      xml_element: 'PckgTxPric',
      validation_rules: [],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_084',
      field_name: 'Package Transaction Price Currency',
      description: 'Currency of the package transaction price',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when Package Transaction Price is provided',
      cdm_path: 'trade_event.package_transaction_price_currency',
      xml_element: 'PckgTxPricCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_085',
      field_name: 'Package Transaction Price Notation',
      description: 'Notation for package transaction price',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['MONE', 'PERC', 'YIEL', 'BAPO'],
      condition: 'Required when Package Transaction Price is provided',
      cdm_path: 'trade_event.package_transaction_price_notation',
      xml_element: 'PckgTxPricNtn',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE']
    },
    // =========================================================================
    // COLLATERAL & MARGIN (Fields 86-110) - MARGIN REPORT TYPE
    // =========================================================================
    {
      field_id: 'EMIR_086',
      field_name: 'Collateralisation Category',
      description: 'Category of collateralisation',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['UNCL', 'PRC1', 'PRC2', 'PRCL', 'OWC1', 'OWC2', 'OWP1', 'OWP2', 'FLCL'],
      cdm_path: 'collateral.collateralisation_category',
      xml_element: 'Coll',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION', 'MARGIN']
    },
    {
      field_id: 'EMIR_087',
      field_name: 'Collateral Portfolio Code',
      description: 'Portfolio code for collateral arrangements',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 52,
      condition: 'Required when collateral is exchanged at portfolio level',
      cdm_path: 'collateral.portfolio_code',
      xml_element: 'CollPrtflCd',
      validation_rules: [],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_088',
      field_name: 'Initial Margin Posted',
      description: 'Value of initial margin posted by reporting counterparty',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required when initial margin is exchanged',
      cdm_path: 'collateral.initial_margin_posted',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'InitlMrgnPstd',
      validation_rules: ['NON_NEGATIVE'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_089',
      field_name: 'Initial Margin Posted Currency',
      description: 'Currency of initial margin posted',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when Initial Margin Posted is provided',
      cdm_path: 'collateral.initial_margin_posted_currency',
      xml_element: 'InitlMrgnPstdCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_090',
      field_name: 'Initial Margin Collected',
      description: 'Value of initial margin collected by reporting counterparty',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required when initial margin is exchanged',
      cdm_path: 'collateral.initial_margin_collected',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'InitlMrgnCllctd',
      validation_rules: ['NON_NEGATIVE'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_091',
      field_name: 'Initial Margin Collected Currency',
      description: 'Currency of initial margin collected',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when Initial Margin Collected is provided',
      cdm_path: 'collateral.initial_margin_collected_currency',
      xml_element: 'InitlMrgnCllctdCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_092',
      field_name: 'Variation Margin Posted',
      description: 'Value of variation margin posted by reporting counterparty',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required when variation margin is exchanged',
      cdm_path: 'collateral.variation_margin_posted',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'VartnMrgnPstd',
      validation_rules: ['NON_NEGATIVE'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_093',
      field_name: 'Variation Margin Posted Currency',
      description: 'Currency of variation margin posted',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when Variation Margin Posted is provided',
      cdm_path: 'collateral.variation_margin_posted_currency',
      xml_element: 'VartnMrgnPstdCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_094',
      field_name: 'Variation Margin Collected',
      description: 'Value of variation margin collected',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required when variation margin is exchanged',
      cdm_path: 'collateral.variation_margin_collected',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'VartnMrgnCllctd',
      validation_rules: ['NON_NEGATIVE'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_095',
      field_name: 'Variation Margin Collected Currency',
      description: 'Currency of variation margin collected',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when Variation Margin Collected is provided',
      cdm_path: 'collateral.variation_margin_collected_currency',
      xml_element: 'VartnMrgnCllctdCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_096',
      field_name: 'Excess Collateral Posted',
      description: 'Value of excess collateral posted',
      data_type: 'decimal',
      requirement: 'conditional',
      cdm_path: 'collateral.excess_collateral_posted',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'XcssCollPstd',
      validation_rules: ['NON_NEGATIVE'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_097',
      field_name: 'Excess Collateral Collected',
      description: 'Value of excess collateral collected',
      data_type: 'decimal',
      requirement: 'conditional',
      cdm_path: 'collateral.excess_collateral_collected',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'XcssCollCllctd',
      validation_rules: ['NON_NEGATIVE'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_098',
      field_name: 'Excess Collateral Posted Currency',
      description: 'Currency of excess collateral posted',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'collateral.excess_collateral_posted_currency',
      xml_element: 'XcssCollPstdCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_099',
      field_name: 'Excess Collateral Collected Currency',
      description: 'Currency of excess collateral collected',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'collateral.excess_collateral_collected_currency',
      xml_element: 'XcssCollCllctdCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_100',
      field_name: 'Collateral Timestamp',
      description: 'Timestamp of collateral data',
      data_type: 'datetime',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$',
      cdm_path: 'collateral.collateral_timestamp',
      xml_element: 'CollTmStmp',
      validation_rules: ['DATETIME_FORMAT'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_101',
      field_name: 'Collateral Market Value',
      description: 'Market value of collateral',
      data_type: 'decimal',
      requirement: 'conditional',
      cdm_path: 'collateral.market_value',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'CollMktVal',
      validation_rules: [],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_102',
      field_name: 'Collateral Type',
      description: 'Type of collateral',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['CASH', 'SECU', 'COMM', 'OTHR'],
      cdm_path: 'collateral.collateral_type',
      xml_element: 'CollTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_103',
      field_name: 'Collateral Quality',
      description: 'Quality of collateral',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['INVG', 'NIVG', 'NOTR', 'NOAP'],
      cdm_path: 'collateral.collateral_quality',
      xml_element: 'CollQlty',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_104',
      field_name: 'Collateral Currency',
      description: 'Currency of the collateral',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'collateral.collateral_currency',
      xml_element: 'CollCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_105',
      field_name: 'Collateral ISIN',
      description: 'ISIN of collateral securities',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 12,
      pattern: '^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      cdm_path: 'collateral.collateral_isin',
      xml_element: 'CollISIN',
      validation_rules: ['ISIN_FORMAT'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_106',
      field_name: 'Collateral Country',
      description: 'Country of collateral issuer',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      cdm_path: 'collateral.collateral_country',
      xml_element: 'CollCtry',
      validation_rules: ['ISO_COUNTRY'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_107',
      field_name: 'Haircut or Margin',
      description: 'Haircut or margin percentage applied',
      data_type: 'decimal',
      requirement: 'conditional',
      cdm_path: 'collateral.haircut_or_margin',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'HrcutOrMrgn',
      validation_rules: [],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_108',
      field_name: 'Action Type Collateral',
      description: 'Action type for collateral update',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'EROR', 'CORR', 'TERM'],
      cdm_path: 'collateral.action_type',
      xml_element: 'ActnTpColl',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_109',
      field_name: 'Netting Eligible',
      description: 'Whether collateral is eligible for netting',
      data_type: 'boolean',
      requirement: 'conditional',
      cdm_path: 'collateral.netting_eligible',
      xml_element: 'NttgElgbl',
      validation_rules: [],
      report_types: ['MARGIN']
    },
    {
      field_id: 'EMIR_110',
      field_name: 'Margin Lending Transaction',
      description: 'Indicator for margin lending transactions',
      data_type: 'boolean',
      requirement: 'conditional',
      cdm_path: 'collateral.margin_lending_transaction',
      xml_element: 'MrgnLndgTx',
      validation_rules: [],
      report_types: ['MARGIN']
    },
    // =========================================================================
    // VALUATION (Fields 111-125) - VALUATION REPORT TYPE
    // =========================================================================
    {
      field_id: 'EMIR_111',
      field_name: 'Valuation Amount',
      description: 'Mark-to-market or mark-to-model value',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'valuation.mtm_value',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'ValtnAmt',
      validation_rules: [],
      report_types: ['VALUATION']
    },
    {
      field_id: 'EMIR_112',
      field_name: 'Valuation Currency',
      description: 'Currency of the valuation',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'valuation.mtm_currency',
      xml_element: 'ValtnCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['VALUATION']
    },
    {
      field_id: 'EMIR_113',
      field_name: 'Valuation Timestamp',
      description: 'Timestamp of the valuation',
      data_type: 'datetime',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$',
      cdm_path: 'valuation.valuation_timestamp',
      xml_element: 'ValtnTmStmp',
      validation_rules: ['DATETIME_FORMAT'],
      report_types: ['VALUATION']
    },
    {
      field_id: 'EMIR_114',
      field_name: 'Valuation Method',
      description: 'Method used for valuation',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['MTMA', 'MTMO'],
      cdm_path: 'valuation.valuation_method',
      xml_element: 'ValtnMthd',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['VALUATION']
    },
    {
      field_id: 'EMIR_115',
      field_name: 'Delta',
      description: 'Delta of the option contract',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for options',
      cdm_path: 'valuation.delta',
      transform: 'FORMAT_DECIMAL_25_17',
      xml_element: 'Dlta',
      validation_rules: [],
      report_types: ['VALUATION']
    },
    {
      field_id: 'EMIR_116',
      field_name: 'Prior UTI',
      description: 'Unique Transaction Identifier of the prior transaction that was modified or terminated',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 52,
      pattern: '^[A-Z0-9]{52}$',
      condition: 'Required when Action Type is MODI, TERM, or CORR relating to prior transaction',
      cdm_path: 'transaction.prior_uti',
      xml_element: 'PrrUTI',
      validation_rules: ['UTI_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_117',
      field_name: 'Subsequent Position UTI',
      description: 'UTI of the position into which the transaction was included',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 52,
      pattern: '^[A-Z0-9]{52}$',
      condition: 'Required when transaction is included in a position',
      cdm_path: 'transaction.subsequent_position_uti',
      xml_element: 'SbsqntPstnUTI',
      validation_rules: ['UTI_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_118',
      field_name: 'Post Trade Risk Reduction',
      description: 'Indicates whether the transaction results from post-trade risk reduction service',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'transaction.post_trade_risk_reduction',
      xml_element: 'PstTradRskRdctn',
      validation_rules: ['BOOLEAN'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_119',
      field_name: 'Post Trade Risk Reduction Event Type',
      description: 'Type of post-trade risk reduction service',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['CMPR', 'RPNT', 'CAPR', 'POSD', 'OTHR'],
      condition: 'Required when Post Trade Risk Reduction is TRUE',
      cdm_path: 'transaction.post_trade_risk_reduction_event_type',
      xml_element: 'PstTradRskRdctnEvntTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_120',
      field_name: 'Package Transaction',
      description: 'Indicates whether the trade is part of a package transaction',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'transaction.package_transaction',
      xml_element: 'PckgTxn',
      validation_rules: ['BOOLEAN'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_121',
      field_name: 'Package Identifier',
      description: 'Identifier of the package if trade is part of package',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 35,
      condition: 'Required when Package Transaction is TRUE',
      cdm_path: 'transaction.package_identifier',
      xml_element: 'PckgIdr',
      validation_rules: [],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_122',
      field_name: 'Intragroup Transaction',
      description: 'Indicates whether the transaction is intragroup',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'transaction.intragroup_transaction',
      xml_element: 'IntrGrpTxn',
      validation_rules: ['BOOLEAN'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_123',
      field_name: 'NFC Financial Nature',
      description: 'Indicates whether the NFC counterparty has financial nature for this trade',
      data_type: 'boolean',
      requirement: 'conditional',
      condition: 'Required when Counterparty is NFC',
      cdm_path: 'counterparty.nfc_financial_nature',
      xml_element: 'NFCFinNtr',
      validation_rules: ['BOOLEAN'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_124',
      field_name: 'Clearing Threshold of Counterparty',
      description: 'Clearing threshold status of the reporting counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['ABOV', 'BLWT'],
      cdm_path: 'counterparty.clearing_threshold',
      xml_element: 'ClrThrshld',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_125',
      field_name: 'Clearing Threshold of Other Counterparty',
      description: 'Clearing threshold status of the other counterparty',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['ABOV', 'BLWT'],
      condition: 'Required when other counterparty is an EU entity',
      cdm_path: 'counterparty.other_clearing_threshold',
      xml_element: 'OthrClrThrshld',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE']
    },
    // =========================================================================
    // POSITION-SPECIFIC FIELDS (Fields 126-145) - POSITION REPORT TYPE
    // =========================================================================
    {
      field_id: 'EMIR_126',
      field_name: 'Position Type',
      description: 'Type of position',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['GROSS', 'NET'],
      cdm_path: 'position.position_type',
      xml_element: 'PstnTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_127',
      field_name: 'Quantity',
      description: 'Number of contracts in the position',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'position.quantity',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'Qty',
      validation_rules: ['POSITIVE_NUMBER'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_128',
      field_name: 'Notional Amount of Position Leg 1',
      description: 'Notional amount of the first leg of the position',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'position.notional_amount_leg1',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'NtnlAmtLeg1',
      validation_rules: ['POSITIVE_NUMBER'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_129',
      field_name: 'Notional Currency of Position Leg 1',
      description: 'Currency of the notional amount of the first leg',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'position.notional_currency_leg1',
      xml_element: 'NtnlCcyLeg1',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_130',
      field_name: 'Notional Amount of Position Leg 2',
      description: 'Notional amount of the second leg of the position',
      data_type: 'decimal',
      requirement: 'conditional',
      cdm_path: 'position.notional_amount_leg2',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'NtnlAmtLeg2',
      validation_rules: ['POSITIVE_NUMBER'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_131',
      field_name: 'Notional Currency of Position Leg 2',
      description: 'Currency of the notional amount of the second leg',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'position.notional_currency_leg2',
      xml_element: 'NtnlCcyLeg2',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_132',
      field_name: 'Effective Date of Position',
      description: 'Effective date of the position',
      data_type: 'date',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      cdm_path: 'position.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_133',
      field_name: 'Maturity Date of Position',
      description: 'Maturity date of the position',
      data_type: 'date',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      cdm_path: 'position.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_134',
      field_name: 'Report Submitting Entity ID',
      description: 'LEI of the entity submitting the report',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'reporting.submitting_entity_id',
      xml_element: 'RptSubmtgNttyId',
      validation_rules: ['LEI_FORMAT', 'VALID_LEI'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_135',
      field_name: 'Entity Responsible for Reporting',
      description: 'LEI of the entity responsible for reporting',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'reporting.responsible_entity_id',
      xml_element: 'NttyRspnsblForRptg',
      validation_rules: ['LEI_FORMAT', 'VALID_LEI'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    },
    {
      field_id: 'EMIR_136',
      field_name: 'Action Type for Position',
      description: 'Type of action taken on the position report',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR', 'REVI', 'POSC'],
      cdm_path: 'position.action_type',
      xml_element: 'ActnTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_137',
      field_name: 'Event Type for Position',
      description: 'Lifecycle event type for the position',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['TRAD', 'NOVA', 'COMP', 'PTNG', 'TERM'],
      cdm_path: 'position.event_type',
      xml_element: 'EvtTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_138',
      field_name: 'Position Reference Date',
      description: 'Reference date as of which the position is reported',
      data_type: 'date',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      cdm_path: 'position.reference_date',
      xml_element: 'PstnRefDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_139',
      field_name: 'Settlement Amount Position',
      description: 'Settlement amount for the position',
      data_type: 'decimal',
      requirement: 'conditional',
      cdm_path: 'position.settlement_amount',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'SttlmAmt',
      validation_rules: [],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_140',
      field_name: 'Settlement Currency Position',
      description: 'Currency of the settlement amount for position',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'position.settlement_currency',
      xml_element: 'SttlmCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_141',
      field_name: 'Fixed Rate Position Leg 1',
      description: 'Fixed rate for the first leg of the position',
      data_type: 'decimal',
      requirement: 'conditional',
      cdm_path: 'position.fixed_rate_leg1',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'FxdRateLeg1',
      validation_rules: [],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_142',
      field_name: 'Fixed Rate Position Leg 2',
      description: 'Fixed rate for the second leg of the position',
      data_type: 'decimal',
      requirement: 'conditional',
      cdm_path: 'position.fixed_rate_leg2',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'FxdRateLeg2',
      validation_rules: [],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_143',
      field_name: 'Floating Rate of Position Leg 1',
      description: 'Floating rate index for the first leg of the position',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      cdm_path: 'position.floating_rate_leg1',
      xml_element: 'FltnRateLeg1',
      validation_rules: [],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_144',
      field_name: 'Floating Rate of Position Leg 2',
      description: 'Floating rate index for the second leg of the position',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      cdm_path: 'position.floating_rate_leg2',
      xml_element: 'FltnRateLeg2',
      validation_rules: [],
      report_types: ['POSITION']
    },
    {
      field_id: 'EMIR_145',
      field_name: 'Position Timestamp',
      description: 'Timestamp of the position calculation',
      data_type: 'datetime',
      requirement: 'mandatory',
      cdm_path: 'position.timestamp',
      xml_element: 'PstnTmStmp',
      validation_rules: ['DATETIME_FORMAT'],
      report_types: ['POSITION']
    },
    // =========================================================================
    // ADDITIONAL FIELDS FOR COMPLETENESS (Fields 146-203)
    // =========================================================================
    {
      field_id: 'EMIR_146',
      field_name: 'Platform Identifier',
      description: 'Identifier of the platform if executed on platform',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 4,
      pattern: '^[A-Z0-9]{4}$',
      cdm_path: 'execution.platform_identifier',
      xml_element: 'PltfrmIdr',
      validation_rules: ['MIC_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_147',
      field_name: 'Confirmation Timestamp',
      description: 'Timestamp of trade confirmation',
      data_type: 'datetime',
      requirement: 'conditional',
      cdm_path: 'trade_event.confirmation_timestamp',
      xml_element: 'CnfrmtnTmStmp',
      validation_rules: ['DATETIME_FORMAT'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_148',
      field_name: 'Confirmation Means',
      description: 'How the trade was confirmed',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['ELEC', 'NONELEC'],
      cdm_path: 'trade_event.confirmation_means',
      xml_element: 'CnfrmtnMns',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_149',
      field_name: 'Settlement Location',
      description: 'Location where settlement takes place',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      cdm_path: 'settlement.settlement_location',
      xml_element: 'SttlmLctn',
      validation_rules: ['ISO_COUNTRY'],
      report_types: ['TRADE']
    },
    {
      field_id: 'EMIR_150',
      field_name: 'Compression',
      description: 'Whether contract results from compression',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.is_compressed',
      xml_element: 'Cmprssn',
      validation_rules: [],
      report_types: ['TRADE']
    },
    // =========================================================================
    // UNDERLYING IDENTIFIERS (Fields 151-160)
    // =========================================================================
    {
      field_id: 'EMIR_151',
      field_name: 'Underlying Identification Type',
      description: 'Type of identifier used for the underlying asset',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['ISIN', 'INTC', 'CUSP', 'OTHR'],
      condition: 'Required when underlying exists',
      cdm_path: 'product.underlying_identification_type',
      xml_element: 'UndrlygIdTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_152',
      field_name: 'Underlying Identifier',
      description: 'Identifier of the underlying asset',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      condition: 'Required when underlying exists',
      cdm_path: 'product.underlying_identifier',
      xml_element: 'UndrlygId',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_153',
      field_name: 'Underlying Index Name',
      description: 'Name of the underlying index',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 100,
      condition: 'Required for index-based derivatives',
      cdm_path: 'product.underlying_index_name',
      xml_element: 'UndrlygIndxNm',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_154',
      field_name: 'Underlying Index Term Value',
      description: 'Numeric term value for index-based products',
      data_type: 'integer',
      requirement: 'conditional',
      condition: 'Required for index-based derivatives',
      cdm_path: 'product.underlying_index_term_value',
      xml_element: 'UndrlygIndxTermVal',
      validation_rules: ['POSITIVE_INTEGER'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_155',
      field_name: 'Underlying Index Term Unit',
      description: 'Unit of the index term (DAYS, WEEK, MNTH, YEAR)',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DAYS', 'WEEK', 'MNTH', 'YEAR'],
      condition: 'Required when term value is populated',
      cdm_path: 'product.underlying_index_term_unit',
      xml_element: 'UndrlygIndxTermUnit',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_156',
      field_name: 'Basket Constituent Identifier',
      description: 'Identifier for constituent of a basket',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      condition: 'Required for basket products',
      cdm_path: 'product.basket_constituent_id',
      xml_element: 'BsktCnstntId',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_157',
      field_name: 'Basket Constituent Weight',
      description: 'Weight of constituent in the basket',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for basket products',
      cdm_path: 'product.basket_constituent_weight',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'BsktCnstntWght',
      validation_rules: ['POSITIVE_NUMBER', 'MAX_VALUE_1'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_158',
      field_name: 'Custom Basket Code',
      description: 'Identifier code for custom basket',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 35,
      condition: 'Required for custom baskets',
      cdm_path: 'product.custom_basket_code',
      xml_element: 'CstmBsktCd',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_159',
      field_name: 'Underlying Issuer LEI',
      description: 'LEI of the issuer of the underlying instrument',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required when underlying issuer has LEI',
      cdm_path: 'product.underlying_issuer_lei',
      xml_element: 'UndrlygIssrLEI',
      validation_rules: ['LEI_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_160',
      field_name: 'Underlying Country',
      description: 'Country of the underlying asset',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      condition: 'Required for equity derivatives',
      cdm_path: 'product.underlying_country',
      xml_element: 'UndrlygCtry',
      validation_rules: ['ISO_COUNTRY'],
      report_types: ['TRADE', 'POSITION']
    },
    // =========================================================================
    // OPTION SPECIFICS (Fields 161-175)
    // =========================================================================
    {
      field_id: 'EMIR_161',
      field_name: 'Option Type',
      description: 'Type of option - call or put',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for options',
      enum_values: ['CALL', 'PUTO'],
      cdm_path: 'product.option_type',
      xml_element: 'OptnTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_162',
      field_name: 'Option Exercise Style',
      description: 'Style of option exercise',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for options',
      enum_values: ['AMER', 'EURO', 'BERM'],
      cdm_path: 'product.option_exercise_style',
      xml_element: 'OptnExrcStyle',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_163',
      field_name: 'Strike Price',
      description: 'Strike price of the option',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for options',
      cdm_path: 'product.strike_price',
      transform: 'FORMAT_DECIMAL_18_13',
      xml_element: 'StrkPric',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_164',
      field_name: 'Strike Price Currency',
      description: 'Currency of the strike price',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when strike price is provided',
      cdm_path: 'product.strike_price_currency',
      xml_element: 'StrkPricCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_165',
      field_name: 'Strike Price Notation',
      description: 'Manner of expressing the strike price',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['MONE', 'PERC', 'YIEL', 'BASP'],
      condition: 'Required for options',
      cdm_path: 'product.strike_price_notation',
      xml_element: 'StrkPricNtn',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_166',
      field_name: 'Strike Price Schedule Unadjusted Effective Date',
      description: 'Unadjusted effective date for strike price schedule',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required for options with scheduled strike changes',
      cdm_path: 'product.strike_schedule_effective_date',
      xml_element: 'StrkPricSchdUnadjstdFctvDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_167',
      field_name: 'Strike Price Schedule Unadjusted End Date',
      description: 'Unadjusted end date for strike price schedule',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required when schedule effective date provided',
      cdm_path: 'product.strike_schedule_end_date',
      xml_element: 'StrkPricSchdUnadjstdEndDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_168',
      field_name: 'Strike Price Schedule Strike Price',
      description: 'Strike price in the schedule',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required when schedule effective date provided',
      cdm_path: 'product.strike_schedule_price',
      transform: 'FORMAT_DECIMAL_18_13',
      xml_element: 'StrkPricSchdStrkPric',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_169',
      field_name: 'Option Premium Amount',
      description: 'Premium paid for the option',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for options',
      cdm_path: 'product.option_premium_amount',
      transform: 'FORMAT_DECIMAL_25_5',
      xml_element: 'OptnPrmAmt',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_170',
      field_name: 'Option Premium Currency',
      description: 'Currency of the option premium',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when premium amount provided',
      cdm_path: 'product.option_premium_currency',
      xml_element: 'OptnPrmCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_171',
      field_name: 'Option Premium Payment Date',
      description: 'Payment date for option premium',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required when premium amount provided',
      cdm_path: 'product.option_premium_payment_date',
      xml_element: 'OptnPrmPmtDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_172',
      field_name: 'Option Maturity Date Unadjusted',
      description: 'Unadjusted maturity date for the option',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required for options',
      cdm_path: 'product.option_maturity_date_unadjusted',
      xml_element: 'OptnMtrtyDtUnadjstd',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_173',
      field_name: 'First Exercise Date',
      description: 'First date the option can be exercised',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required for American and Bermudan options',
      cdm_path: 'product.first_exercise_date',
      xml_element: 'FrstExrcDt',
      validation_rules: ['DATE_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_174',
      field_name: 'Option Barrier Type',
      description: 'Type of barrier for barrier options',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['KIKO', 'KOKI', 'OTHR'],
      condition: 'Required for barrier options',
      cdm_path: 'product.option_barrier_type',
      xml_element: 'OptnBarrTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_175',
      field_name: 'Option Barrier Level',
      description: 'Barrier level for barrier options',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for barrier options',
      cdm_path: 'product.option_barrier_level',
      transform: 'FORMAT_DECIMAL_18_13',
      xml_element: 'OptnBarrLvl',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    // =========================================================================
    // CREDIT DERIVATIVE SPECIFICS (Fields 176-185)
    // =========================================================================
    {
      field_id: 'EMIR_176',
      field_name: 'Reference Entity',
      description: 'Name of reference entity for credit derivatives',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for credit derivatives',
      cdm_path: 'product.reference_entity',
      xml_element: 'RefNtty',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_177',
      field_name: 'Reference Entity LEI',
      description: 'LEI of the reference entity',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required when reference entity has LEI',
      cdm_path: 'product.reference_entity_lei',
      xml_element: 'RefNttyLEI',
      validation_rules: ['LEI_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_178',
      field_name: 'Reference Obligation Type',
      description: 'Type of the reference obligation',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['SNDB', 'SNSE', 'SUBD', 'OTHR'],
      condition: 'Required for credit derivatives',
      cdm_path: 'product.reference_obligation_type',
      xml_element: 'RefOblgtnTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_179',
      field_name: 'Reference Obligation ISIN',
      description: 'ISIN of the reference obligation',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 12,
      pattern: '^[A-Z]{2}[A-Z0-9]{10}$',
      condition: 'Required when reference obligation has ISIN',
      cdm_path: 'product.reference_obligation_isin',
      xml_element: 'RefOblgtnISIN',
      validation_rules: ['ISIN_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_180',
      field_name: 'Seniority',
      description: 'Seniority of the credit derivative',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['SNDB', 'SBOD', 'JUND', 'OTHR'],
      condition: 'Required for credit derivatives',
      cdm_path: 'product.seniority',
      xml_element: 'Snrty',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_181',
      field_name: 'Index Series',
      description: 'Series identifier of the credit index',
      data_type: 'integer',
      requirement: 'conditional',
      condition: 'Required for credit index derivatives',
      cdm_path: 'product.index_series',
      xml_element: 'IndxSrs',
      validation_rules: ['POSITIVE_INTEGER'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_182',
      field_name: 'Index Version',
      description: 'Version of the credit index',
      data_type: 'integer',
      requirement: 'conditional',
      condition: 'Required for credit index derivatives',
      cdm_path: 'product.index_version',
      xml_element: 'IndxVrsn',
      validation_rules: ['POSITIVE_INTEGER'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_183',
      field_name: 'Index Factor',
      description: 'Current index factor',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for credit index derivatives',
      cdm_path: 'product.index_factor',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'IndxFctr',
      validation_rules: ['POSITIVE_NUMBER', 'MAX_VALUE_1'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_184',
      field_name: 'Tranche',
      description: 'Indicates whether contract is tranched',
      data_type: 'boolean',
      requirement: 'conditional',
      condition: 'Required for credit derivatives',
      cdm_path: 'product.is_tranched',
      xml_element: 'Trnch',
      validation_rules: ['BOOLEAN'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_185',
      field_name: 'Credit Event',
      description: 'Type of credit event',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DFLT', 'BKCY', 'RRSP', 'FDCV', 'GVIX', 'OTHR'],
      condition: 'Required for credit event reports',
      cdm_path: 'product.credit_event_type',
      xml_element: 'CdtEvt',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    // =========================================================================
    // COMMODITY SPECIFICS (Fields 186-195)
    // =========================================================================
    {
      field_id: 'EMIR_186',
      field_name: 'Commodity Base',
      description: 'Base commodity type',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for commodity derivatives',
      enum_values: ['AGRI', 'NRGY', 'ENVR', 'FRGT', 'FRTL', 'INDP', 'METL', 'MCEX', 'PAPR', 'POLY', 'INFL', 'OTHC'],
      cdm_path: 'product.commodity_base',
      xml_element: 'CmdtyBase',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_187',
      field_name: 'Commodity Detail',
      description: 'Detailed commodity type',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for commodity derivatives',
      cdm_path: 'product.commodity_detail',
      xml_element: 'CmdtyDtl',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_188',
      field_name: 'Delivery Point',
      description: 'Point where commodity is delivered',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 100,
      condition: 'Required for physically settled commodity derivatives',
      cdm_path: 'product.delivery_point',
      xml_element: 'DlvryPt',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_189',
      field_name: 'Delivery Point or Zone',
      description: 'EIC code for delivery point or zone',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 16,
      condition: 'Required for energy derivatives in EU',
      cdm_path: 'product.delivery_zone',
      xml_element: 'DlvryPtOrZone',
      validation_rules: ['EIC_CODE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_190',
      field_name: 'Interconnection Point',
      description: 'EIC code for interconnection point',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 16,
      condition: 'Required for gas derivatives',
      cdm_path: 'product.interconnection_point',
      xml_element: 'IntrcnnctnPt',
      validation_rules: ['EIC_CODE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_191',
      field_name: 'Load Type',
      description: 'Type of load profile for electricity',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['BASE', 'PEAK', 'OFFP', 'OTHR'],
      condition: 'Required for electricity derivatives',
      cdm_path: 'product.load_type',
      xml_element: 'LdTp',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_192',
      field_name: 'Load Delivery Intervals',
      description: 'Delivery intervals for load',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 100,
      condition: 'Required for electricity derivatives',
      cdm_path: 'product.load_delivery_intervals',
      xml_element: 'LdDlvryIntrvls',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_193',
      field_name: 'Delivery Start Date and Time',
      description: 'Start date and time for commodity delivery',
      data_type: 'datetime',
      requirement: 'conditional',
      condition: 'Required for commodity derivatives',
      cdm_path: 'product.delivery_start_datetime',
      xml_element: 'DlvryStrtDtTm',
      validation_rules: ['DATETIME_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_194',
      field_name: 'Delivery End Date and Time',
      description: 'End date and time for commodity delivery',
      data_type: 'datetime',
      requirement: 'conditional',
      condition: 'Required for commodity derivatives',
      cdm_path: 'product.delivery_end_datetime',
      xml_element: 'DlvryEndDtTm',
      validation_rules: ['DATETIME_FORMAT'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_195',
      field_name: 'Duration',
      description: 'Duration of the contract',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['MNUT', 'HOUR', 'DAYD', 'WEEK', 'MNTH', 'QURT', 'SEAS', 'YEAR', 'OTHR'],
      condition: 'Required for commodity derivatives',
      cdm_path: 'product.duration',
      xml_element: 'Drtn',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    // =========================================================================
    // FX SPECIFICS (Fields 196-203)
    // =========================================================================
    {
      field_id: 'EMIR_196',
      field_name: 'Exchange Rate',
      description: 'Exchange rate for FX derivatives',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for FX derivatives',
      cdm_path: 'product.exchange_rate',
      transform: 'FORMAT_DECIMAL_18_10',
      xml_element: 'XchgRate',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_197',
      field_name: 'Exchange Rate Basis',
      description: 'Currency pair for exchange rate',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for FX derivatives',
      cdm_path: 'product.exchange_rate_basis',
      xml_element: 'XchgRateBsis',
      validation_rules: [],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_198',
      field_name: 'Delivery Currency',
      description: 'Currency to be delivered in FX forward',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required for FX forwards',
      cdm_path: 'product.delivery_currency',
      xml_element: 'DlvryCcy',
      validation_rules: ['ISO_CURRENCY'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_199',
      field_name: 'Day Count Fraction',
      description: 'Day count convention used',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A007', 'A008', 'A009', 'A010', 'A011', 'A012', 'A013', 'A014', 'A015', 'A016', 'A017', 'A018', 'A019', 'A020', 'NARR'],
      cdm_path: 'product.day_count_fraction',
      xml_element: 'DayCntFrctn',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_200',
      field_name: 'Payment Frequency Leg 1',
      description: 'Payment frequency for the first leg',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DAIL', 'WEEK', 'MNTH', 'YEAR', 'ADHO', 'EXPI', 'OVNG'],
      cdm_path: 'product.payment_frequency_leg1',
      xml_element: 'PmtFrqcyLeg1',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_201',
      field_name: 'Payment Frequency Leg 2',
      description: 'Payment frequency for the second leg',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DAIL', 'WEEK', 'MNTH', 'YEAR', 'ADHO', 'EXPI', 'OVNG'],
      cdm_path: 'product.payment_frequency_leg2',
      xml_element: 'PmtFrqcyLeg2',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_202',
      field_name: 'Reset Frequency Leg 1',
      description: 'Reset frequency for floating rate leg 1',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DAIL', 'WEEK', 'MNTH', 'YEAR'],
      cdm_path: 'product.reset_frequency_leg1',
      xml_element: 'RstFrqcyLeg1',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION']
    },
    {
      field_id: 'EMIR_203',
      field_name: 'Level',
      description: 'Indicates whether report is transaction or position level',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['TCTN', 'PSTN'],
      cdm_path: 'trade_event.reporting_level',
      xml_element: 'Lvl',
      validation_rules: ['ENUM_VALUE'],
      report_types: ['TRADE', 'POSITION', 'VALUATION', 'MARGIN']
    }
  ],
  validation_rules: [
    {
      rule_id: 'EMIR_VR001',
      name: 'LEI Format Validation',
      description: 'Validates LEI format and checksum',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{18}[0-9]{2}$ AND checksum_valid(LEI)',
      error_message: 'Invalid LEI format or checksum',
      affected_fields: ['EMIR_001', 'EMIR_002', 'EMIR_003', 'EMIR_019']
    },
    {
      rule_id: 'EMIR_VR002',
      name: 'UTI Format Validation',
      description: 'Validates UTI format per ISO 23897',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UTI matches ^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      error_message: 'Invalid UTI format',
      affected_fields: ['EMIR_004', 'EMIR_005']
    },
    {
      rule_id: 'EMIR_VR003',
      name: 'CCP Required for Cleared',
      description: 'CCP ID must be provided when contract is cleared',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Cleared = true THEN CCP_ID is not empty',
      error_message: 'CCP ID required when contract is cleared',
      affected_fields: ['EMIR_018', 'EMIR_019']
    },
    {
      rule_id: 'EMIR_VR004',
      name: 'Prior UTI for Lifecycle Events',
      description: 'Prior UTI required for modification/termination events',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type IN (MODI, TERM, CORR) THEN Prior_UTI is not empty',
      error_message: 'Prior UTI required for lifecycle events',
      affected_fields: ['EMIR_005', 'EMIR_006']
    },
    {
      rule_id: 'EMIR_VR005',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Effective_Date',
      error_message: 'Maturity date must be after effective date',
      affected_fields: ['EMIR_009', 'EMIR_010']
    },
    {
      rule_id: 'EMIR_VR006',
      name: 'Notional Amount Positive',
      description: 'Notional amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be greater than zero',
      affected_fields: ['EMIR_014']
    },
    {
      rule_id: 'EMIR_VR007',
      name: 'FC Sector Required',
      description: 'Sector required for financial counterparties',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Counterparty_Nature = FC THEN Sector is not empty',
      error_message: 'Sector required for financial counterparties',
      affected_fields: ['EMIR_022', 'EMIR_023']
    },
    {
      rule_id: 'EMIR_VR008',
      name: 'ISIN Format',
      description: 'ISIN must match ISO 6166 format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'ISIN matches ^[A-Z]{2}[A-Z0-9]{9}[0-9]$ AND isin_checksum_valid(ISIN)',
      error_message: 'Invalid ISIN format',
      affected_fields: ['EMIR_013']
    }
  ]
};

// =============================================================================
// MiFIR RTS 25 Package - Complete 65 Fields
// =============================================================================
export const MIFIR_PACKAGE: RegulationPackage = {
  package_id: 'mifir-rts25-2024',
  regulation_code: 'MIFIR',
  regulation_name: 'Markets in Financial Instruments Regulation RTS 25',
  version: 'RTS 25 v2.0',
  effective_date: '2024-01-01',
  description: 'MiFIR transaction reporting requirements under RTS 25. Complete 65-field specification for reporting securities transactions to national competent authorities (NCAs).',
  jurisdiction: 'EU',
  reporting_authority: 'NCAs',
  field_count: 65,
  mandatory_fields: 38,
  conditional_fields: 20,
  optional_fields: 7,
  validation_rule_count: 45,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:iso:std:iso:20022:tech:xsd:auth.016.001.01',
  output_root_element: 'Document',
  tags: ['transaction-reporting', 'securities', 'MiFID-II', 'NCA', 'EU', 'RTS-25'],
  fields: [
    {
      field_id: 'MIFIR_001',
      field_name: 'Report Status',
      description: 'Indicates if this is a new report, cancellation, or amendment',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'CANC', 'AMND'],
      cdm_path: 'trade_event.action_type',
      transform: 'MAP_MIFIR_ACTION',
      xml_element: 'RptSts',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_002',
      field_name: 'Transaction Reference Number',
      description: 'Unique identifier for the transaction',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      cdm_path: 'trade_event.internal_trade_id',
      xml_element: 'TxRefNb',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_003',
      field_name: 'Trading Venue Transaction ID',
      description: 'Identifier assigned by the trading venue',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 52,
      condition: 'Required for on-venue transactions',
      condition_expr: { field: 'execution.trading_venue_mic', operator: 'ne', value: 'XOFF' },
      cdm_path: 'trade_event.venue_transaction_id',
      xml_element: 'TradgVnTxId',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_004',
      field_name: 'Executing Entity ID',
      description: 'LEI of the entity executing the transaction',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=EXECUTING].lei',
      xml_element: 'ExctgPty',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'MIFIR_005',
      field_name: 'Submitting Entity ID',
      description: 'LEI of the entity submitting the report',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=SUBMITTING].lei',
      xml_element: 'SubmitgPty',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'MIFIR_006',
      field_name: 'Buyer ID Type',
      description: 'Type of identifier for the buyer',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['LEI', 'MIC', 'INTC', 'NIDN'],
      cdm_path: 'parties[role=BUYER].id_type',
      xml_element: 'BuyrIdTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_007',
      field_name: 'Buyer ID',
      description: 'Identifier of the buyer',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 50,
      cdm_path: 'parties[role=BUYER].identifier',
      xml_element: 'BuyrId',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_008',
      field_name: 'Seller ID Type',
      description: 'Type of identifier for the seller',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['LEI', 'MIC', 'INTC', 'NIDN'],
      cdm_path: 'parties[role=SELLER].id_type',
      xml_element: 'SellrIdTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_009',
      field_name: 'Seller ID',
      description: 'Identifier of the seller',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 50,
      cdm_path: 'parties[role=SELLER].identifier',
      xml_element: 'SellrId',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_010',
      field_name: 'Trading DateTime',
      description: 'Date and time of execution',
      data_type: 'datetime',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{6})?Z$',
      cdm_path: 'execution.execution_timestamp',
      transform: 'FORMAT_ISO_DATETIME_MICRO',
      xml_element: 'TradgDtTm',
      validation_rules: ['DATETIME_FORMAT']
    },
    {
      field_id: 'MIFIR_011',
      field_name: 'Trading Capacity',
      description: 'Capacity in which the firm traded',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['DEAL', 'MTCH', 'APTS'],
      cdm_path: 'execution.trading_capacity',
      xml_element: 'TradgCpcty',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_012',
      field_name: 'Quantity',
      description: 'Number of units or nominal amount',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.quantity',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'Qty',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'MIFIR_013',
      field_name: 'Quantity Currency',
      description: 'Currency if quantity is nominal',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required for nominal amounts',
      condition_expr: { field: 'product.quantity_notation', operator: 'in', value: ['NOML', 'MONE'] },
      cdm_path: 'product.quantity_currency',
      xml_element: 'QtyCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'MIFIR_014',
      field_name: 'Price',
      description: 'Traded price',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.price',
      transform: 'FORMAT_DECIMAL_18_13',
      xml_element: 'Pric',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_015',
      field_name: 'Price Currency',
      description: 'Currency of the price',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.price_currency',
      xml_element: 'PricCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'MIFIR_016',
      field_name: 'Net Amount',
      description: 'Net cash amount of the transaction',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for cash transactions',
      condition_expr: { field: 'product.is_cash_settled', operator: 'eq', value: true },
      cdm_path: 'product.net_amount',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'NetAmt',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_017',
      field_name: 'Venue',
      description: 'MIC code of the trading venue',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 4,
      pattern: '^[A-Z0-9]{4}$',
      cdm_path: 'execution.trading_venue_mic',
      xml_element: 'TradVn',
      validation_rules: ['MIC_FORMAT']
    },
    {
      field_id: 'MIFIR_018',
      field_name: 'Country of Branch',
      description: 'Country of the branch executing the transaction',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      condition: 'Required if different from head office',
      condition_expr: { field: 'parties[role=EXECUTING].country_of_branch', operator: 'exists' },
      cdm_path: 'parties[role=EXECUTING].country_of_branch',
      xml_element: 'CtryOfBrnch',
      validation_rules: ['ISO_COUNTRY']
    },
    {
      field_id: 'MIFIR_019',
      field_name: 'Instrument ID Type',
      description: 'Type of instrument identifier',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['ISIN', 'OTHR'],
      cdm_path: 'product.instrument_id_type',
      xml_element: 'InstrmIdTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_020',
      field_name: 'Instrument ID',
      description: 'Identifier of the financial instrument',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      cdm_path: 'product.isin',
      xml_element: 'InstrmId',
      validation_rules: ['ISIN_FORMAT']
    },
    {
      field_id: 'MIFIR_021',
      field_name: 'Instrument Full Name',
      description: 'Full name of the financial instrument',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 350,
      condition: 'Required when ISIN not available',
      condition_expr: { field: 'product.instrument_id_type', operator: 'eq', value: 'OTHR' },
      cdm_path: 'product.instrument_name',
      xml_element: 'InstrmFullNm',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_022',
      field_name: 'Instrument Classification',
      description: 'CFI code of the instrument',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 6,
      pattern: '^[A-Z]{6}$',
      condition: 'Required when ISIN not available',
      condition_expr: { field: 'product.instrument_id_type', operator: 'eq', value: 'OTHR' },
      cdm_path: 'product.cfi_code',
      xml_element: 'InstrmClssfctn',
      validation_rules: ['CFI_FORMAT']
    },
    {
      field_id: 'MIFIR_023',
      field_name: 'Waiver Indicator',
      description: 'Type of waiver under which the trade was executed',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['OILQ', 'NLIQ', 'PRIC', 'SIZE', 'ILQD'],
      condition: 'Required for waivered trades',
      condition_expr: { field: 'execution.has_waiver', operator: 'eq', value: true },
      cdm_path: 'execution.waiver_indicator',
      xml_element: 'WvrInd',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_024',
      field_name: 'Short Selling Indicator',
      description: 'Indicates if the sale was a short sale',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['SESH', 'SSEX', 'SELL', 'UNDI'],
      condition: 'Required for sell transactions',
      condition_expr: { field: 'execution.is_sell_side', operator: 'eq', value: true },
      cdm_path: 'execution.short_selling_indicator',
      xml_element: 'ShrtSellgInd',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_025',
      field_name: 'OTC Post-Trade Indicator',
      description: 'Flag for OTC post-trade publication',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['BENC', 'ACTX', 'LRGS', 'ILQD', 'SIZE', 'CANC', 'AMND', 'SDIV', 'RPRI', 'DUPL', 'TNCP', 'TPAC', 'XFPH'],
      condition: 'Required for OTC trades',
      condition_expr: { field: 'execution.trading_venue_mic', operator: 'eq', value: 'XOFF' },
      cdm_path: 'execution.otc_post_trade_indicator',
      xml_element: 'OTCPstTradInd',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_026',
      field_name: 'Up-front Payment',
      description: 'Up-front payment amount for derivatives',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for derivative transactions',
      condition_expr: { field: 'product.is_derivative', operator: 'eq', value: true },
      cdm_path: 'product.upfront_payment',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'UpFrntPmt',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_027',
      field_name: 'Up-front Payment Currency',
      description: 'Currency of the up-front payment',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when up-front payment is reported',
      condition_expr: { field: 'product.upfront_payment', operator: 'exists' },
      cdm_path: 'product.upfront_payment_currency',
      xml_element: 'UpFrntPmtCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'MIFIR_028',
      field_name: 'Investment Decision Maker',
      description: 'Person/algorithm making investment decision',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      condition: 'Required for client orders',
      condition_expr: { field: 'execution.trading_capacity', operator: 'eq', value: 'APTS' },
      cdm_path: 'execution.investment_decision_maker',
      xml_element: 'InvstmtDcsnMakr',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_029',
      field_name: 'Execution Decision Maker',
      description: 'Person/algorithm responsible for execution',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      condition: 'Required when applicable',
      condition_expr: { field: 'execution.execution_decision_maker', operator: 'exists' },
      cdm_path: 'execution.execution_decision_maker',
      xml_element: 'ExctnDcsnMakr',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_030',
      field_name: 'Commodity Derivative Indicator',
      description: 'Indicates if the transaction is in a commodity derivative',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'product.is_commodity_derivative',
      xml_element: 'CmmdtyDerivInd',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_031',
      field_name: 'Securities Financing Transaction Indicator',
      description: 'Indicates if this is a securities financing transaction',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.is_sft',
      xml_element: 'SctiesFincgTxInd',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_032',
      field_name: 'Transmission Indicator',
      description: 'Indicates if order was transmitted',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'execution.is_transmitted_order',
      xml_element: 'TrnsmssnInd',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_033',
      field_name: 'Complex Trade Component ID',
      description: 'ID linking components of a complex trade',
      data_type: 'string',
      requirement: 'optional',
      max_length: 35,
      cdm_path: 'trade_event.complex_trade_id',
      xml_element: 'CmplxTradCmpntId',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_034',
      field_name: 'Report Timestamp',
      description: 'Timestamp of report submission',
      data_type: 'datetime',
      requirement: 'optional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$',
      cdm_path: 'trade_event.report_timestamp',
      transform: 'FORMAT_ISO_DATETIME',
      xml_element: 'RptTmStmp',
      validation_rules: ['DATETIME_FORMAT']
    },
    // === Additional MiFIR Fields (35-65) ===
    {
      field_id: 'MIFIR_035',
      field_name: 'Buyer Decision Maker Code',
      description: 'Identifier of the person or algorithm making the investment decision for the buyer',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      condition: 'Required when buyer is a client',
      condition_expr: { field: 'parties[role=BUYER].is_client', operator: 'eq', value: true },
      cdm_path: 'parties[role=BUYER].decision_maker_id',
      xml_element: 'BuyrDcsnMkrCd',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_036',
      field_name: 'Buyer Decision Maker Code Type',
      description: 'Type of identifier for buyer decision maker',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['NIDN', 'CCPT', 'LEIC', 'NIDE', 'OTHR'],
      condition: 'Required when Buyer Decision Maker Code is populated',
      condition_expr: { field: 'parties[role=BUYER].decision_maker_id', operator: 'exists' },
      cdm_path: 'parties[role=BUYER].decision_maker_id_type',
      xml_element: 'BuyrDcsnMkrCdTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_037',
      field_name: 'Seller Decision Maker Code',
      description: 'Identifier of the person or algorithm making the investment decision for the seller',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      condition: 'Required when seller is a client',
      condition_expr: { field: 'parties[role=SELLER].is_client', operator: 'eq', value: true },
      cdm_path: 'parties[role=SELLER].decision_maker_id',
      xml_element: 'SellrDcsnMkrCd',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_038',
      field_name: 'Seller Decision Maker Code Type',
      description: 'Type of identifier for seller decision maker',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['NIDN', 'CCPT', 'LEIC', 'NIDE', 'OTHR'],
      condition: 'Required when Seller Decision Maker Code is populated',
      condition_expr: { field: 'parties[role=SELLER].decision_maker_id', operator: 'exists' },
      cdm_path: 'parties[role=SELLER].decision_maker_id_type',
      xml_element: 'SellrDcsnMkrCdTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_039',
      field_name: 'Buyer Execution Within Firm Code',
      description: 'Identifier of the person or algorithm responsible for execution on buyer side',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      condition: 'Required when firm acts as buyer',
      condition_expr: { field: 'execution.firm_is_buyer', operator: 'eq', value: true },
      cdm_path: 'execution.buyer_executor_id',
      xml_element: 'BuyrExctnWthnFrmCd',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_040',
      field_name: 'Seller Execution Within Firm Code',
      description: 'Identifier of the person or algorithm responsible for execution on seller side',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 50,
      condition: 'Required when firm acts as seller',
      condition_expr: { field: 'execution.firm_is_seller', operator: 'eq', value: true },
      cdm_path: 'execution.seller_executor_id',
      xml_element: 'SellrExctnWthnFrmCd',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_041',
      field_name: 'Underlying Instrument ISIN',
      description: 'ISIN of the underlying instrument for derivatives',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 12,
      pattern: '^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      condition: 'Required for derivative instruments',
      condition_expr: { field: 'product.is_derivative', operator: 'eq', value: true },
      cdm_path: 'product.underlying_isin',
      xml_element: 'UndrlygInstrmISIN',
      validation_rules: ['ISIN_FORMAT']
    },
    {
      field_id: 'MIFIR_042',
      field_name: 'Underlying Instrument Index Name',
      description: 'Name of the underlying index',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 25,
      condition: 'Required when underlying is an index',
      condition_expr: { field: 'product.underlying_type', operator: 'eq', value: 'INDEX' },
      cdm_path: 'product.underlying_index_name',
      xml_element: 'UndrlygInstrmIndxNm',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_043',
      field_name: 'Underlying Instrument Index Term Value',
      description: 'Term/tenor value of the underlying index',
      data_type: 'integer',
      requirement: 'conditional',
      condition: 'Required when underlying is an index with a term',
      condition_expr: { and: [
        { field: 'product.underlying_type', operator: 'eq', value: 'INDEX' },
        { field: 'product.underlying_index_term_value', operator: 'exists' }
      ]},
      cdm_path: 'product.underlying_index_term_value',
      xml_element: 'UndrlygInstrmIndxTermVal',
      validation_rules: ['POSITIVE_INTEGER']
    },
    {
      field_id: 'MIFIR_044',
      field_name: 'Underlying Instrument Index Term Unit',
      description: 'Unit of the term (days, weeks, months, years)',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['DAYS', 'WEEK', 'MNTH', 'YEAR'],
      condition: 'Required when Index Term Value is populated',
      condition_expr: { field: 'product.underlying_index_term_value', operator: 'exists' },
      cdm_path: 'product.underlying_index_term_unit',
      xml_element: 'UndrlygInstrmIndxTermUnit',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_045',
      field_name: 'Option Type',
      description: 'Type of option (put or call)',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['PUTO', 'CALL', 'OTHR'],
      condition: 'Required for options',
      condition_expr: { field: 'product.is_option', operator: 'eq', value: true },
      cdm_path: 'product.option_type',
      xml_element: 'OptnTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_046',
      field_name: 'Strike Price',
      description: 'Strike price of the option',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for options',
      condition_expr: { field: 'product.is_option', operator: 'eq', value: true },
      cdm_path: 'product.strike_price',
      transform: 'FORMAT_DECIMAL_18_13',
      xml_element: 'StrkPric',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_047',
      field_name: 'Strike Price Currency',
      description: 'Currency of the strike price',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when Strike Price is populated',
      condition_expr: { field: 'product.strike_price', operator: 'exists' },
      cdm_path: 'product.strike_price_currency',
      xml_element: 'StrkPricCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'MIFIR_048',
      field_name: 'Option Exercise Style',
      description: 'Style of option exercise (American, European, etc.)',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['AMER', 'EURO', 'BERM', 'ASIA'],
      condition: 'Required for options',
      condition_expr: { field: 'product.is_option', operator: 'eq', value: true },
      cdm_path: 'product.option_exercise_style',
      xml_element: 'OptnExrcStyle',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_049',
      field_name: 'Maturity Date',
      description: 'Maturity or expiry date of the instrument',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required for derivatives and bonds',
      condition_expr: { or: [
        { field: 'product.is_derivative', operator: 'eq', value: true },
        { field: 'product.instrument_type', operator: 'eq', value: 'BOND' }
      ]},
      cdm_path: 'product.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['DATE_FORMAT']
    },
    {
      field_id: 'MIFIR_050',
      field_name: 'Expiry Date',
      description: 'Expiry date for derivatives',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required for options and futures',
      condition_expr: { or: [
        { field: 'product.is_option', operator: 'eq', value: true },
        { field: 'product.is_future', operator: 'eq', value: true }
      ]},
      cdm_path: 'product.expiry_date',
      xml_element: 'XpryDt',
      validation_rules: ['DATE_FORMAT']
    },
    {
      field_id: 'MIFIR_051',
      field_name: 'Delivery Type',
      description: 'Delivery type for derivatives (physical or cash)',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['PHYS', 'CASH', 'OPTL'],
      condition: 'Required for derivatives',
      condition_expr: { field: 'product.is_derivative', operator: 'eq', value: true },
      cdm_path: 'product.delivery_type',
      xml_element: 'DlvryTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_052',
      field_name: 'Price Multiplier',
      description: 'Number of units of the underlying per derivative contract',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for derivatives',
      condition_expr: { field: 'product.is_derivative', operator: 'eq', value: true },
      cdm_path: 'product.price_multiplier',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'PricMltplr',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'MIFIR_053',
      field_name: 'Notional Amount',
      description: 'Notional amount of the derivative contract',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for swaps and forwards',
      condition_expr: { or: [
        { field: 'product.is_swap', operator: 'eq', value: true },
        { field: 'product.is_forward', operator: 'eq', value: true }
      ]},
      cdm_path: 'product.notional_amount',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'NtnlAmt',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'MIFIR_054',
      field_name: 'Notional Currency',
      description: 'Currency of the notional amount',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when Notional Amount is populated',
      condition_expr: { field: 'product.notional_amount', operator: 'exists' },
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'MIFIR_055',
      field_name: 'Quantity Notation',
      description: 'Notation type for quantity (units, nominal, monetary)',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['UNIT', 'NOML', 'MONE'],
      cdm_path: 'product.quantity_notation',
      xml_element: 'QtyNtn',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_056',
      field_name: 'Price Notation',
      description: 'Notation type for price (unit, percent, yield, basis points)',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['MONE', 'PERC', 'YIEL', 'BAPO'],
      cdm_path: 'product.price_notation',
      xml_element: 'PricNtn',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_057',
      field_name: 'Country of Branch Membership',
      description: 'Country where branch membership is held for venue access',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      condition: 'Required when trading through a branch',
      condition_expr: { field: 'execution.is_branch_trade', operator: 'eq', value: true },
      cdm_path: 'parties[role=EXECUTING].branch_membership_country',
      xml_element: 'CtryOfBrnchMmbrshp',
      validation_rules: ['ISO_COUNTRY']
    },
    {
      field_id: 'MIFIR_058',
      field_name: 'Country of Branch Supervision',
      description: 'Country where branch is supervised',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      condition: 'Required when trading through a branch',
      condition_expr: { field: 'execution.is_branch_trade', operator: 'eq', value: true },
      cdm_path: 'parties[role=EXECUTING].branch_supervision_country',
      xml_element: 'CtryOfBrnchSprvsn',
      validation_rules: ['ISO_COUNTRY']
    },
    {
      field_id: 'MIFIR_059',
      field_name: 'Derivative Notional Increase Decrease',
      description: 'Indicates change in derivative notional (increase/decrease)',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['INCR', 'DECR'],
      condition: 'Required for notional changes in derivatives',
      condition_expr: { and: [
        { field: 'product.is_derivative', operator: 'eq', value: true },
        { field: 'trade_event.action_type', operator: 'in', value: ['MODI', 'AMND'] }
      ]},
      cdm_path: 'trade_event.notional_change_direction',
      xml_element: 'DerivNtnlIncrDcrs',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MIFIR_060',
      field_name: 'Aggregated Transaction',
      description: 'Indicates if this is an aggregated transaction',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.is_aggregated',
      xml_element: 'AggtdTx',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_061',
      field_name: 'Investment Decision Within Firm Algo',
      description: 'Indicates if investment decision was made by algorithm',
      data_type: 'boolean',
      requirement: 'conditional',
      condition: 'Required when reporting firm made investment decision',
      condition_expr: { field: 'execution.trading_capacity', operator: 'eq', value: 'DEAL' },
      cdm_path: 'execution.investment_decision_by_algo',
      xml_element: 'InvstmtDcsnWthnFrmAlgo',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_062',
      field_name: 'Execution Within Firm Algo',
      description: 'Indicates if execution was performed by algorithm',
      data_type: 'boolean',
      requirement: 'conditional',
      condition: 'Required when firm executed the transaction',
      condition_expr: { field: 'execution.firm_executed', operator: 'eq', value: true },
      cdm_path: 'execution.execution_by_algo',
      xml_element: 'ExctnWthnFrmAlgo',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_063',
      field_name: 'Client Facing Transaction',
      description: 'Indicates if transaction involves a client',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.is_client_facing',
      xml_element: 'ClntFcgTx',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_064',
      field_name: 'Report To Be Amended',
      description: 'Transaction Reference Number of report being amended',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 52,
      condition: 'Required when Report Status is AMND',
      condition_expr: { field: 'trade_event.action_type', operator: 'eq', value: 'AMND' },
      cdm_path: 'trade_event.amended_report_reference',
      xml_element: 'RptToBeAmndd',
      validation_rules: []
    },
    {
      field_id: 'MIFIR_065',
      field_name: 'Report To Be Cancelled',
      description: 'Transaction Reference Number of report being cancelled',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 52,
      condition: 'Required when Report Status is CANC',
      condition_expr: { field: 'trade_event.action_type', operator: 'eq', value: 'CANC' },
      cdm_path: 'trade_event.cancelled_report_reference',
      xml_element: 'RptToBeCancld',
      validation_rules: []
    }
  ],
  validation_rules: [
    {
      rule_id: 'MIFIR_VR001',
      name: 'LEI Format',
      description: 'Validates LEI format for all LEI fields',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{18}[0-9]{2}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['MIFIR_004', 'MIFIR_005']
    },
    {
      rule_id: 'MIFIR_VR002',
      name: 'ISIN Format',
      description: 'Validates ISIN format and checksum',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'ISIN matches ^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      error_message: 'Invalid ISIN format',
      affected_fields: ['MIFIR_020']
    },
    {
      rule_id: 'MIFIR_VR003',
      name: 'MIC Format',
      description: 'Validates MIC code format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'MIC matches ^[A-Z0-9]{4}$',
      error_message: 'Invalid MIC format',
      affected_fields: ['MIFIR_017']
    },
    {
      rule_id: 'MIFIR_VR004',
      name: 'Buyer Seller Different',
      description: 'Buyer and seller must be different entities',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Buyer_ID != Seller_ID',
      error_message: 'Buyer and seller cannot be the same entity',
      affected_fields: ['MIFIR_007', 'MIFIR_009']
    },
    {
      rule_id: 'MIFIR_VR005',
      name: 'Price Positive',
      description: 'Price must be positive (or zero for certain instruments)',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Price >= 0',
      error_message: 'Price should be positive',
      affected_fields: ['MIFIR_014']
    },
    {
      rule_id: 'MIFIR_VR006',
      name: 'Quantity Positive',
      description: 'Quantity must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Quantity > 0',
      error_message: 'Quantity must be greater than zero',
      affected_fields: ['MIFIR_012']
    },
    {
      rule_id: 'MIFIR_VR007',
      name: 'Short Selling for Sells',
      description: 'Short selling indicator required for sell transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Buyer_ID = Executing_Entity THEN Short_Selling_Indicator is empty ELSE Short_Selling_Indicator is not empty',
      error_message: 'Short selling indicator required for sell transactions',
      affected_fields: ['MIFIR_024']
    },
    {
      rule_id: 'MIFIR_VR008',
      name: 'Instrument Classification Required',
      description: 'CFI required when ISIN not available',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Instrument_ID_Type = OTHR THEN Instrument_Classification is not empty',
      error_message: 'Instrument classification required when ISIN not available',
      affected_fields: ['MIFIR_019', 'MIFIR_022']
    },
    {
      rule_id: 'MIFIR_VR009',
      name: 'Trading Date Time Format',
      description: 'Trading date and time must be valid UTC datetime',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'Trading_Date_Time matches ISO 8601 with UTC timezone',
      error_message: 'Trading date time must be in ISO 8601 format with UTC',
      affected_fields: ['MIFIR_026']
    },
    {
      rule_id: 'MIFIR_VR010',
      name: 'Currency Code ISO 4217',
      description: 'Currency codes must be valid ISO 4217',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'Currency matches ^[A-Z]{3}$',
      error_message: 'Invalid currency code format',
      affected_fields: ['MIFIR_013', 'MIFIR_015', 'MIFIR_040']
    },
    {
      rule_id: 'MIFIR_VR011',
      name: 'Trading Capacity Valid',
      description: 'Trading capacity must be DEAL, MTCH, AOTC, or OTHR',
      severity: 'ERROR',
      rule_type: 'enumeration',
      expression: 'Trading_Capacity IN (DEAL, MTCH, AOTC, OTHR)',
      error_message: 'Invalid trading capacity value',
      affected_fields: ['MIFIR_025']
    },
    {
      rule_id: 'MIFIR_VR012',
      name: 'Transaction Reference Unique',
      description: 'Transaction Reference Number must be unique per reporting entity',
      severity: 'ERROR',
      rule_type: 'uniqueness',
      expression: 'Transaction_Reference_Number is unique per Executing_Entity',
      error_message: 'Duplicate transaction reference number',
      affected_fields: ['MIFIR_002']
    },
    {
      rule_id: 'MIFIR_VR013',
      name: 'Derivative Expiry Date',
      description: 'Derivative maturity date required for derivative instruments',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Instrument_Classification starts with (O, F, C, R, S) THEN Derivative_Expiry_Date is not empty',
      error_message: 'Maturity date required for derivative instruments',
      affected_fields: ['MIFIR_022', 'MIFIR_042']
    },
    {
      rule_id: 'MIFIR_VR014',
      name: 'Strike Price for Options',
      description: 'Strike price required for option instruments',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Instrument_Classification starts with O THEN Strike_Price is not empty',
      error_message: 'Strike price required for option instruments',
      affected_fields: ['MIFIR_022', 'MIFIR_044']
    },
    {
      rule_id: 'MIFIR_VR015',
      name: 'Option Type for Options',
      description: 'Option type (PUT/CALL) required for option instruments',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Instrument_Classification starts with O THEN Option_Type IN (PUT, CALL)',
      error_message: 'Option type required for option instruments',
      affected_fields: ['MIFIR_022', 'MIFIR_045']
    },
    {
      rule_id: 'MIFIR_VR016',
      name: 'Notional Amount Positive',
      description: 'Notional amount must be positive for derivatives',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be greater than zero',
      affected_fields: ['MIFIR_039']
    },
    {
      rule_id: 'MIFIR_VR017',
      name: 'Waiver Indicator Valid',
      description: 'Waiver indicator must be valid code',
      severity: 'ERROR',
      rule_type: 'enumeration',
      expression: 'Waiver_Indicator IN (LRGS, RFPT, NLIQ, OILQ, PRIC, SIZE, ILQD)',
      error_message: 'Invalid waiver indicator value',
      affected_fields: ['MIFIR_028']
    },
    {
      rule_id: 'MIFIR_VR018',
      name: 'OTC Post-Trade Indicator Valid',
      description: 'OTC post-trade indicator must be valid code',
      severity: 'ERROR',
      rule_type: 'enumeration',
      expression: 'OTC_Post_Trade_Indicator IN (BENC, ACTX, LRGS, ILQD, SIZE, CANC, AMND, SDIV, RPRI, DUPL, TNCP, TPAC)',
      error_message: 'Invalid OTC post-trade indicator value',
      affected_fields: ['MIFIR_029']
    },
    {
      rule_id: 'MIFIR_VR019',
      name: 'Venue MIC for Exchange Trades',
      description: 'Valid MIC required for exchange-traded transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Trading_Venue != XOFF THEN Trading_Venue is valid MIC',
      error_message: 'Valid venue MIC required for exchange trades',
      affected_fields: ['MIFIR_017']
    },
    {
      rule_id: 'MIFIR_VR020',
      name: 'Buyer Decision Maker Required',
      description: 'Buyer decision maker required when buyer is not natural person',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Buyer_ID_Type = LEI THEN Buyer_Decision_Maker_ID is required',
      error_message: 'Decision maker identification required for legal entity buyers',
      affected_fields: ['MIFIR_007', 'MIFIR_008']
    },
    {
      rule_id: 'MIFIR_VR021',
      name: 'Seller Decision Maker Required',
      description: 'Seller decision maker required when seller is not natural person',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Seller_ID_Type = LEI THEN Seller_Decision_Maker_ID is required',
      error_message: 'Decision maker identification required for legal entity sellers',
      affected_fields: ['MIFIR_009', 'MIFIR_010']
    },
    {
      rule_id: 'MIFIR_VR022',
      name: 'Commodity Derivative Quantity Unit',
      description: 'Quantity unit required for commodity derivatives',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Underlying_Asset_Type = COMM THEN Quantity_Unit is not empty',
      error_message: 'Quantity unit required for commodity derivatives',
      affected_fields: ['MIFIR_048', 'MIFIR_053']
    },
    {
      rule_id: 'MIFIR_VR023',
      name: 'Up-front Payment for Swaps',
      description: 'Up-front payment required for certain swap types',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Instrument_Classification starts with S THEN Up_Front_Payment is populated',
      error_message: 'Up-front payment should be reported for swap transactions',
      affected_fields: ['MIFIR_022', 'MIFIR_054']
    },
    {
      rule_id: 'MIFIR_VR024',
      name: 'Delivery Type for Derivatives',
      description: 'Delivery type required for derivative instruments',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Asset_Class = DERV THEN Delivery_Type IN (CASH, PHYS, OPTL)',
      error_message: 'Valid delivery type required for derivatives',
      affected_fields: ['MIFIR_055']
    },
    {
      rule_id: 'MIFIR_VR025',
      name: 'Cancellation Reference',
      description: 'Original transaction reference required for cancellations',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Report_Status = CANC THEN Cancelled_Report_Reference is not empty',
      error_message: 'Original transaction reference required for cancellation reports',
      affected_fields: ['MIFIR_064', 'MIFIR_065']
    },
    {
      rule_id: 'MIFIR_VR026',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum validation per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['MIFIR_004', 'MIFIR_005', 'MIFIR_007', 'MIFIR_009']
    },
    {
      rule_id: 'MIFIR_VR027',
      name: 'ISIN Checksum Validation',
      description: 'ISIN must pass Luhn checksum validation',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'isin_checksum_valid(ISIN)',
      error_message: 'ISIN checksum validation failed',
      affected_fields: ['MIFIR_020']
    },
    {
      rule_id: 'MIFIR_VR028',
      name: 'Valid MIC Code',
      description: 'MIC must be registered in ISO 10383 registry',
      severity: 'WARNING',
      rule_type: 'referential',
      expression: 'MIC IN valid_mic_codes OR MIC IN (XOFF, XXXX, SINT)',
      error_message: 'MIC code not found in ISO 10383 registry',
      affected_fields: ['MIFIR_017']
    },
    {
      rule_id: 'MIFIR_VR029',
      name: 'Valid Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN ISO_4217_CURRENCIES',
      error_message: 'Currency code not in ISO 4217',
      affected_fields: ['MIFIR_015', 'MIFIR_013']
    },
    {
      rule_id: 'MIFIR_VR030',
      name: 'Trading Time Not Future',
      description: 'Trading timestamp cannot be in the future',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Trading_DateTime <= NOW()',
      error_message: 'Trading timestamp cannot be in the future',
      affected_fields: ['MIFIR_010']
    },
    {
      rule_id: 'MIFIR_VR031',
      name: 'T+1 Reporting Deadline',
      description: 'Transaction reports should be submitted by end of T+1',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Submission_DateTime <= Trading_DateTime + 1 business day',
      error_message: 'Report may be late - T+1 reporting deadline applies',
      affected_fields: ['MIFIR_010']
    },
    {
      rule_id: 'MIFIR_VR032',
      name: 'Reasonable Price Range',
      description: 'Price should be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Price < 1e12',
      error_message: 'Price appears unusually high',
      affected_fields: ['MIFIR_014']
    },
    {
      rule_id: 'MIFIR_VR033',
      name: 'Reasonable Quantity Range',
      description: 'Quantity should be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Quantity < 1e15',
      error_message: 'Quantity appears unusually high',
      affected_fields: ['MIFIR_012']
    },
    {
      rule_id: 'MIFIR_VR034',
      name: 'Net Amount Consistency',
      description: 'Net amount should approximately equal price times quantity',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'ABS(Net_Amount - Price * Quantity) / Net_Amount < 0.01',
      error_message: 'Net amount does not match price * quantity',
      affected_fields: ['MIFIR_014', 'MIFIR_012', 'MIFIR_016']
    },
    {
      rule_id: 'MIFIR_VR035',
      name: 'Venue Transaction ID for On-Venue',
      description: 'Trading venue transaction ID required for on-venue trades',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Venue NOT IN (XOFF, XXXX, SINT) THEN Venue_Transaction_ID is not empty',
      error_message: 'Trading venue transaction ID required for on-venue transactions',
      affected_fields: ['MIFIR_003', 'MIFIR_017']
    },
    {
      rule_id: 'MIFIR_VR036',
      name: 'Instrument Full Name for Non-ISIN',
      description: 'Instrument full name required when ISIN not available',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Instrument_ID_Type = OTHR THEN Instrument_Full_Name is not empty',
      error_message: 'Instrument full name required when ISIN not available',
      affected_fields: ['MIFIR_019', 'MIFIR_021']
    },
    {
      rule_id: 'MIFIR_VR037',
      name: 'Short Selling Only for Sells',
      description: 'Short selling indicator only valid for sell transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Short_Selling_Indicator is not empty THEN Buy_Sell = SELL',
      error_message: 'Short selling indicator only valid for sell transactions',
      affected_fields: ['MIFIR_031']
    },
    {
      rule_id: 'MIFIR_VR038',
      name: 'Valid Waiver Indicator',
      description: 'Waiver indicator must be valid MiFIR pre-trade waiver code',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Waiver_Indicator IN (OILQ, NLIQ, PRIC, SIZE, RFPT, BENC, ILQD, RPRI, TNCP)',
      error_message: 'Invalid waiver indicator code',
      affected_fields: ['MIFIR_030']
    },
    {
      rule_id: 'MIFIR_VR039',
      name: 'Valid Short Selling Indicator',
      description: 'Short selling indicator must be valid code',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Short_Selling_Indicator IN (SESH, SSEX, SELL, UNDI)',
      error_message: 'Invalid short selling indicator',
      affected_fields: ['MIFIR_031']
    },
    {
      rule_id: 'MIFIR_VR040',
      name: 'Maturity Date After Trading Date',
      description: 'Maturity date must be on or after trading date',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Maturity_Date >= Trading_Date',
      error_message: 'Maturity date cannot be before trading date',
      affected_fields: ['MIFIR_027', 'MIFIR_010']
    },
    {
      rule_id: 'MIFIR_VR041',
      name: 'CFI Code Format',
      description: 'CFI code must be 6 uppercase letters per ISO 10962',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'CFI matches ^[A-Z]{6}$',
      error_message: 'Invalid CFI code format',
      affected_fields: ['MIFIR_022']
    },
    {
      rule_id: 'MIFIR_VR042',
      name: 'Country Code Validation',
      description: 'Country must be valid ISO 3166-1 alpha-2 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Country IN ISO_3166_COUNTRIES',
      error_message: 'Country code not in ISO 3166-1',
      affected_fields: ['MIFIR_018']
    },
    {
      rule_id: 'MIFIR_VR043',
      name: 'Natural Person Names Required',
      description: 'First name and surname required for natural person identification',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF ID_Type IN (NATI, CCPT, CONCAT) THEN First_Name AND Surname are not empty',
      error_message: 'First name and surname required for natural person identification',
      affected_fields: ['MIFIR_006', 'MIFIR_007']
    },
    {
      rule_id: 'MIFIR_VR044',
      name: 'Decision Maker Country Required',
      description: 'Country of branch required when decision maker is specified',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Decision_Maker_ID is not empty THEN Country_of_Branch is not empty',
      error_message: 'Country of branch should be specified when decision maker provided',
      affected_fields: ['MIFIR_018']
    },
    {
      rule_id: 'MIFIR_VR045',
      name: 'Amendment Reference Required',
      description: 'Original transaction reference required for amendments',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Report_Status = AMND THEN Original_Report_Reference is not empty',
      error_message: 'Original transaction reference required for amendment reports',
      affected_fields: ['MIFIR_001', 'MIFIR_065']
    }
  ]
};

// =============================================================================
// SFTR Package
// =============================================================================
export const SFTR_PACKAGE: RegulationPackage = {
  package_id: 'sftr-2024',
  regulation_code: 'SFTR',
  regulation_name: 'Securities Financing Transactions Regulation',
  version: '2.0',
  effective_date: '2024-01-01',
  description: 'SFTR reporting requirements for securities financing transactions including repos, securities lending, buy-sell backs, and margin lending. Covers 155 fields across counterparty, loan, collateral, and margin data.',
  jurisdiction: 'EU',
  reporting_authority: 'ESMA/NCAs',
  field_count: 37,
  mandatory_fields: 20,
  conditional_fields: 12,
  optional_fields: 5,
  validation_rule_count: 50,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:iso:std:iso:20022:tech:xsd:auth.052.001.01',
  output_root_element: 'Document',
  tags: ['SFT', 'repo', 'securities-lending', 'collateral', 'ESMA', 'EU'],
  report_types: [
    {
      code: 'NEW',
      name: 'New Transaction Report',
      description: 'Report new SFT conclusion',
      action_types: ['NEWT'],
      field_count: 155
    },
    {
      code: 'MODIFICATION',
      name: 'Modification Report',
      description: 'Report modifications to existing SFT',
      action_types: ['MODI', 'ETRM', 'CORR'],
      field_count: 80
    },
    {
      code: 'COLLATERAL',
      name: 'Collateral Update Report',
      description: 'Daily collateral updates for open SFTs',
      action_types: ['COLU'],
      field_count: 45
    },
    {
      code: 'VALUATION',
      name: 'Valuation Update Report',
      description: 'Daily valuation updates for loan and collateral',
      action_types: ['VALU'],
      field_count: 25
    },
    {
      code: 'MARGIN',
      name: 'Margin Update Report',
      description: 'Margin lending updates',
      action_types: ['MARG'],
      field_count: 30
    },
    {
      code: 'REUSE',
      name: 'Reuse Report',
      description: 'Collateral reuse and reinvestment updates',
      action_types: ['REUU'],
      field_count: 20
    }
  ],
  fields: [
    {
      field_id: 'SFTR_001',
      field_name: 'Report Submitting Entity',
      description: 'LEI of the entity submitting the report',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=SUBMITTING].lei',
      xml_element: 'RptSubmitgNtty',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'SFTR_002',
      field_name: 'Reporting Counterparty',
      description: 'LEI of the reporting counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgCtrPty',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'SFTR_003',
      field_name: 'Other Counterparty',
      description: 'LEI of the other counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'OthrCtrPty',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'SFTR_004',
      field_name: 'UTI',
      description: 'Unique Transaction Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      pattern: '^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      cdm_path: 'trade_event.uti',
      xml_element: 'UnqTxIdr',
      validation_rules: ['UTI_FORMAT']
    },
    {
      field_id: 'SFTR_005',
      field_name: 'Report Tracking Number',
      description: 'Report tracking number assigned by TR',
      data_type: 'string',
      requirement: 'optional',
      max_length: 52,
      cdm_path: 'trade_event.report_tracking_number',
      xml_element: 'RptTrckgNb',
      validation_rules: []
    },
    {
      field_id: 'SFTR_006',
      field_name: 'Event Date',
      description: 'Date of the SFT event',
      data_type: 'date',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      cdm_path: 'trade_event.event_timestamp',
      transform: 'EXTRACT_DATE',
      xml_element: 'EvtDt',
      validation_rules: ['DATE_FORMAT']
    },
    {
      field_id: 'SFTR_007',
      field_name: 'Action Type',
      description: 'Type of action for the SFT',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'VALU', 'COLU', 'EROR', 'CORR', 'ETRM', 'POSC'],
      cdm_path: 'trade_event.action_type',
      transform: 'MAP_SFTR_ACTION',
      xml_element: 'Actn',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'SFTR_008',
      field_name: 'SFT Type',
      description: 'Type of securities financing transaction',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['REPO', 'SBSC', 'SLEB', 'MGLD'],
      cdm_path: 'product.sft_type',
      xml_element: 'SFTTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'SFTR_009',
      field_name: 'Execution Timestamp',
      description: 'Execution date and time',
      data_type: 'datetime',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$',
      cdm_path: 'execution.execution_timestamp',
      transform: 'FORMAT_ISO_DATETIME',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['DATETIME_FORMAT']
    },
    {
      field_id: 'SFTR_010',
      field_name: 'Maturity Date',
      description: 'Maturity date of the SFT',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required unless open-term',
      cdm_path: 'trade_event.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['DATE_FORMAT']
    },
    {
      field_id: 'SFTR_011',
      field_name: 'Termination Date',
      description: 'Actual termination date',
      data_type: 'date',
      requirement: 'conditional',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      condition: 'Required for terminated SFTs',
      cdm_path: 'trade_event.termination_date',
      xml_element: 'TermntnDt',
      validation_rules: ['DATE_FORMAT']
    },
    {
      field_id: 'SFTR_012',
      field_name: 'Principal Amount',
      description: 'Principal amount of the loan',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.principal_amount',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'PrncplAmt',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'SFTR_013',
      field_name: 'Principal Currency',
      description: 'Currency of the principal amount',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.principal_currency',
      xml_element: 'PrncplCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'SFTR_014',
      field_name: 'Fixed Rate',
      description: 'Fixed rebate/fee rate',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for fixed-rate SFTs',
      cdm_path: 'product.fixed_rate',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'FxdRate',
      validation_rules: []
    },
    {
      field_id: 'SFTR_015',
      field_name: 'Floating Rate Index',
      description: 'Reference rate for floating rate SFTs',
      data_type: 'string',
      requirement: 'conditional',
      condition: 'Required for floating-rate SFTs',
      cdm_path: 'product.floating_rate_index',
      xml_element: 'FltgRateIndx',
      validation_rules: []
    },
    {
      field_id: 'SFTR_016',
      field_name: 'Spread',
      description: 'Spread over the reference rate',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for floating-rate SFTs',
      cdm_path: 'product.spread',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'Sprd',
      validation_rules: []
    },
    {
      field_id: 'SFTR_017',
      field_name: 'Collateral Type',
      description: 'Type of collateral',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['GOVS', 'SUNS', 'FIDE', 'NFID', 'SEPR', 'MEQU', 'OEQU', 'OTHR'],
      cdm_path: 'collateral.collateral_type',
      xml_element: 'CollTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'SFTR_018',
      field_name: 'Security ISIN',
      description: 'ISIN of the security used as collateral',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 12,
      pattern: '^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      condition: 'Required for specific collateral',
      cdm_path: 'collateral.security_isin',
      xml_element: 'SctyISIN',
      validation_rules: ['ISIN_FORMAT']
    },
    {
      field_id: 'SFTR_019',
      field_name: 'Collateral Quantity',
      description: 'Quantity of collateral provided',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'collateral.quantity',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'CollQty',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'SFTR_020',
      field_name: 'Collateral Market Value',
      description: 'Market value of collateral',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'collateral.market_value',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'CollMktVal',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'SFTR_021',
      field_name: 'Collateral Currency',
      description: 'Currency of collateral value',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'collateral.currency',
      xml_element: 'CollCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'SFTR_022',
      field_name: 'Haircut',
      description: 'Haircut percentage applied',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required when haircut applied',
      cdm_path: 'collateral.haircut',
      transform: 'FORMAT_DECIMAL_11_10',
      xml_element: 'Hrcut',
      validation_rules: []
    },
    {
      field_id: 'SFTR_023',
      field_name: 'Initial Margin Posted',
      description: 'Initial margin posted by reporting counterparty',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required if margin is exchanged',
      cdm_path: 'margin.initial_margin_posted',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'InitlMrgnPstd',
      validation_rules: ['NON_NEGATIVE']
    },
    {
      field_id: 'SFTR_024',
      field_name: 'Initial Margin Received',
      description: 'Initial margin received by reporting counterparty',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required if margin is exchanged',
      cdm_path: 'margin.initial_margin_received',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'InitlMrgnRcvd',
      validation_rules: ['NON_NEGATIVE']
    },
    {
      field_id: 'SFTR_025',
      field_name: 'Variation Margin Posted',
      description: 'Variation margin posted by reporting counterparty',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required if margin is exchanged',
      cdm_path: 'margin.variation_margin_posted',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'VartnMrgnPstd',
      validation_rules: ['NON_NEGATIVE']
    },
    {
      field_id: 'SFTR_026',
      field_name: 'Variation Margin Received',
      description: 'Variation margin received by reporting counterparty',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required if margin is exchanged',
      cdm_path: 'margin.variation_margin_received',
      transform: 'FORMAT_DECIMAL_18_5',
      xml_element: 'VartnMrgnRcvd',
      validation_rules: ['NON_NEGATIVE']
    },
    {
      field_id: 'SFTR_027',
      field_name: 'Margin Currency',
      description: 'Currency of margin amounts',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required when margin is reported',
      cdm_path: 'margin.currency',
      xml_element: 'MrgnCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'SFTR_028',
      field_name: 'Counterparty Nature',
      description: 'Financial or non-financial counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['FINC', 'NFIN'],
      cdm_path: 'parties[role=REPORTING].is_financial_counterparty',
      transform: 'BOOL_TO_FINC_NFIN',
      xml_element: 'CtrPtyNtr',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'SFTR_029',
      field_name: 'Reporting Counterparty Side',
      description: 'Role of reporting counterparty (lender/borrower)',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['GIVE', 'TAKE'],
      cdm_path: 'parties[role=REPORTING].side',
      xml_element: 'RptgCtrPtySd',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'SFTR_030',
      field_name: 'Sector',
      description: 'Sector of the reporting counterparty',
      data_type: 'string',
      requirement: 'conditional',
      enum_values: ['CDTI', 'INVF', 'INUN', 'AIFD', 'ORPI', 'UCIT', 'ASSU', 'REIN', 'PFIN', 'CSDS', 'CCPS', 'OTHR'],
      condition: 'Required for financial counterparties',
      cdm_path: 'parties[role=REPORTING].sector',
      xml_element: 'Sctr',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'SFTR_031',
      field_name: 'Country of Counterparty',
      description: 'Country of the reporting counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 2,
      pattern: '^[A-Z]{2}$',
      cdm_path: 'parties[role=REPORTING].country_of_domicile',
      xml_element: 'CtryOfCtrPty',
      validation_rules: ['ISO_COUNTRY']
    },
    {
      field_id: 'SFTR_032',
      field_name: 'Triparty Agent',
      description: 'LEI of the triparty agent',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required for triparty repos',
      cdm_path: 'parties[role=TRIPARTY_AGENT].lei',
      xml_element: 'TrptyAgt',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'SFTR_033',
      field_name: 'Broker',
      description: 'LEI of the broker',
      data_type: 'string',
      requirement: 'optional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=BROKER].lei',
      xml_element: 'Brkr',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'SFTR_034',
      field_name: 'CCP',
      description: 'LEI of the CCP',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required for cleared SFTs',
      cdm_path: 'trade_event.ccp_lei',
      xml_element: 'CCP',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'SFTR_035',
      field_name: 'Clearing Status',
      description: 'Whether the SFT is cleared',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.clearing_status',
      transform: 'BOOL_TO_CLEARED',
      xml_element: 'ClrSts',
      validation_rules: []
    },
    {
      field_id: 'SFTR_036',
      field_name: 'Master Agreement Type',
      description: 'Type of master agreement',
      data_type: 'string',
      requirement: 'optional',
      enum_values: ['GMRA', 'GMSF', 'ISLA', 'OSLA', 'OTHR'],
      cdm_path: 'trade_event.master_agreement_type',
      xml_element: 'MstrAgrmtTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'SFTR_037',
      field_name: 'Open Term',
      description: 'Whether the SFT has no fixed maturity',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'product.is_open_term',
      xml_element: 'OpnTerm',
      validation_rules: []
    }
  ],
  validation_rules: [
    {
      rule_id: 'SFTR_VR001',
      name: 'LEI Format Validation',
      description: 'Validates all LEI fields',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{18}[0-9]{2}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['SFTR_001', 'SFTR_002', 'SFTR_003', 'SFTR_032', 'SFTR_033', 'SFTR_034']
    },
    {
      rule_id: 'SFTR_VR002',
      name: 'UTI Format Validation',
      description: 'Validates UTI format per ISO 23897',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UTI matches ^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      error_message: 'Invalid UTI format',
      affected_fields: ['SFTR_004']
    },
    {
      rule_id: 'SFTR_VR003',
      name: 'ISIN Format Validation',
      description: 'Validates ISIN format for collateral securities',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'ISIN matches ^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      error_message: 'Invalid ISIN format',
      affected_fields: ['SFTR_018']
    },
    {
      rule_id: 'SFTR_VR004',
      name: 'Maturity Required Unless Open',
      description: 'Maturity date required unless open-term',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Open_Term = false THEN Maturity_Date is not empty',
      error_message: 'Maturity date required for fixed-term SFTs',
      affected_fields: ['SFTR_010', 'SFTR_037']
    },
    {
      rule_id: 'SFTR_VR005',
      name: 'CCP Required for Cleared',
      description: 'CCP LEI required when SFT is cleared',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Clearing_Status = true THEN CCP is not empty',
      error_message: 'CCP LEI required for cleared SFTs',
      affected_fields: ['SFTR_034', 'SFTR_035']
    },
    {
      rule_id: 'SFTR_VR006',
      name: 'Sector Required for Financial',
      description: 'Sector required for financial counterparties',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Counterparty_Nature = FINC THEN Sector is not empty',
      error_message: 'Sector required for financial counterparties',
      affected_fields: ['SFTR_028', 'SFTR_030']
    },
    {
      rule_id: 'SFTR_VR007',
      name: 'Principal Amount Positive',
      description: 'Principal amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Principal_Amount > 0',
      error_message: 'Principal amount must be greater than zero',
      affected_fields: ['SFTR_012']
    },
    {
      rule_id: 'SFTR_VR008',
      name: 'Collateral Value Positive',
      description: 'Collateral market value must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Collateral_Market_Value > 0',
      error_message: 'Collateral market value must be greater than zero',
      affected_fields: ['SFTR_020']
    },
    {
      rule_id: 'SFTR_VR009',
      name: 'Margin Currency Consistency',
      description: 'All margin amounts must use the same currency',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'Margin_Currency is consistent across all margin fields',
      error_message: 'Margin currency should be consistent',
      affected_fields: ['SFTR_023', 'SFTR_024', 'SFTR_025', 'SFTR_026', 'SFTR_027']
    },
    {
      rule_id: 'SFTR_VR010',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum validation per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['SFTR_001', 'SFTR_002', 'SFTR_003', 'SFTR_032', 'SFTR_033', 'SFTR_034']
    },
    {
      rule_id: 'SFTR_VR011',
      name: 'ISIN Checksum Validation',
      description: 'ISIN must pass Luhn checksum per ISO 6166',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'isin_luhn_valid(ISIN)',
      error_message: 'Invalid ISIN checksum',
      affected_fields: ['SFTR_018']
    },
    {
      rule_id: 'SFTR_VR012',
      name: 'ISO Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN iso_4217_codes',
      error_message: 'Invalid ISO 4217 currency code',
      affected_fields: ['SFTR_013', 'SFTR_021', 'SFTR_027']
    },
    {
      rule_id: 'SFTR_VR013',
      name: 'ISO Country Code',
      description: 'Country must be valid ISO 3166-1 alpha-2 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Country IN iso_3166_alpha2',
      error_message: 'Invalid ISO 3166-1 country code',
      affected_fields: ['SFTR_031', 'SFTR_029']
    },
    {
      rule_id: 'SFTR_VR014',
      name: 'MIC Code Validation',
      description: 'Trading venue must be valid ISO 10383 MIC',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'MIC IN iso_10383_mics',
      error_message: 'Invalid MIC code',
      affected_fields: ['SFTR_006']
    },
    {
      rule_id: 'SFTR_VR015',
      name: 'CFI Code Format',
      description: 'CFI code must be valid ISO 10962 format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'CFI matches ^[A-Z]{6}$',
      error_message: 'CFI must be 6 uppercase letters per ISO 10962',
      affected_fields: ['SFTR_016']
    },
    {
      rule_id: 'SFTR_VR016',
      name: 'Execution Date Not Future',
      description: 'Execution date cannot be in the future',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Execution_Timestamp <= current_datetime',
      error_message: 'Execution timestamp cannot be in the future',
      affected_fields: ['SFTR_008']
    },
    {
      rule_id: 'SFTR_VR017',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Value_Date',
      error_message: 'Maturity date must be after value date',
      affected_fields: ['SFTR_009', 'SFTR_010']
    },
    {
      rule_id: 'SFTR_VR018',
      name: 'Repo Rate Reasonable',
      description: 'Repo rate must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Repo_Rate >= -5 AND Repo_Rate <= 50',
      error_message: 'Repo rate outside reasonable bounds (-5% to 50%)',
      affected_fields: ['SFTR_014']
    },
    {
      rule_id: 'SFTR_VR019',
      name: 'Haircut Percentage Valid',
      description: 'Haircut percentage must be between 0 and 100',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Haircut_Percentage >= 0 AND Haircut_Percentage <= 100',
      error_message: 'Haircut percentage must be between 0 and 100',
      affected_fields: ['SFTR_022']
    },
    {
      rule_id: 'SFTR_VR020',
      name: 'Action Type Consistency',
      description: 'Action type must match report lifecycle state',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Action_Type IN [NEWT, MODI, ETRM, CORR, COLU, VALU, MARG, REUU]',
      error_message: 'Invalid action type for SFTR',
      affected_fields: ['SFTR_007']
    },
    {
      rule_id: 'SFTR_VR021',
      name: 'SFT Type Valid',
      description: 'SFT type must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'SFT_Type IN [REPO, BSBA, SLBE, MGLD]',
      error_message: 'Invalid SFT type. Must be REPO, BSBA, SLBE, or MGLD',
      affected_fields: ['SFTR_005']
    },
    {
      rule_id: 'SFTR_VR022',
      name: 'Counterparty Nature Valid',
      description: 'Counterparty nature must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Nature IN [FINC, NFIN]',
      error_message: 'Counterparty nature must be FINC or NFIN',
      affected_fields: ['SFTR_028']
    },
    {
      rule_id: 'SFTR_VR023',
      name: 'Securities Lending Fields Required',
      description: 'Securities lending specific fields required when SFT_Type is SLBE',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF SFT_Type = SLBE THEN Lending_Fee is not empty',
      error_message: 'Lending fee required for securities lending transactions',
      affected_fields: ['SFTR_005', 'SFTR_015']
    },
    {
      rule_id: 'SFTR_VR024',
      name: 'Margin Lending Fields Required',
      description: 'Margin lending specific fields required when SFT_Type is MGLD',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF SFT_Type = MGLD THEN Initial_Margin is not empty',
      error_message: 'Initial margin required for margin lending transactions',
      affected_fields: ['SFTR_005', 'SFTR_023']
    },
    {
      rule_id: 'SFTR_VR025',
      name: 'Collateral Required for Repo',
      description: 'Collateral data required for repo transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF SFT_Type = REPO THEN Collateral_ISIN is not empty',
      error_message: 'Collateral ISIN required for repo transactions',
      affected_fields: ['SFTR_005', 'SFTR_018']
    },
    {
      rule_id: 'SFTR_VR026',
      name: 'Termination Date Consistency',
      description: 'Early termination date must be before original maturity',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = ETRM THEN Termination_Date <= Maturity_Date',
      error_message: 'Early termination date must be before original maturity date',
      affected_fields: ['SFTR_007', 'SFTR_010', 'SFTR_011']
    },
    {
      rule_id: 'SFTR_VR027',
      name: 'T+1 Reporting Deadline',
      description: 'SFT must be reported within T+1 of execution',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Reporting_Timestamp <= Execution_Timestamp + 1 business day',
      error_message: 'SFT should be reported within T+1 of execution',
      affected_fields: ['SFTR_008']
    },
    {
      rule_id: 'SFTR_VR028',
      name: 'Collateral Quality Valid',
      description: 'Collateral quality classification must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Collateral_Quality IN [INVG, NIVG, NOTR, NOAP]',
      error_message: 'Invalid collateral quality classification',
      affected_fields: ['SFTR_019']
    },
    {
      rule_id: 'SFTR_VR029',
      name: 'Collateral Component Unique',
      description: 'Each collateral component must have unique identifier',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Collateral_Component_IDs are unique within transaction',
      error_message: 'Duplicate collateral component identifier',
      affected_fields: ['SFTR_017']
    },
    {
      rule_id: 'SFTR_VR030',
      name: 'Master Agreement Type Valid',
      description: 'Master agreement type must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Master_Agreement_Type IN [GMRA, GMSLA, ISDA, OTHER]',
      error_message: 'Invalid master agreement type',
      affected_fields: ['SFTR_035']
    },
    {
      rule_id: 'SFTR_VR031',
      name: 'Reuse Flag Consistency',
      description: 'Reuse rights flag must be consistent with collateral terms',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Reuse_Allowed = true THEN Reuse_Disclosure is not empty',
      error_message: 'Reuse disclosure required when reuse is allowed',
      affected_fields: ['SFTR_036', 'SFTR_037']
    },
    {
      rule_id: 'SFTR_VR032',
      name: 'Triparty Agent Required',
      description: 'Triparty agent LEI required for triparty SFTs',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Triparty_Indicator = true THEN Triparty_Agent_LEI is not empty',
      error_message: 'Triparty agent LEI required for triparty SFTs',
      affected_fields: ['SFTR_033']
    },
    {
      rule_id: 'SFTR_VR033',
      name: 'Floating Rate Index Valid',
      description: 'Floating rate index must be valid benchmark reference',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'IF Rate_Type = FLOA THEN Floating_Rate_Index is not empty',
      error_message: 'Floating rate index required for floating rate SFTs',
      affected_fields: ['SFTR_014']
    },
    {
      rule_id: 'SFTR_VR034',
      name: 'Spread Reasonable',
      description: 'Spread over benchmark must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Spread >= -500 AND Spread <= 1000 basis points',
      error_message: 'Spread outside reasonable bounds',
      affected_fields: ['SFTR_014']
    },
    {
      rule_id: 'SFTR_VR035',
      name: 'Quantity Positive',
      description: 'Security quantity must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Security_Quantity > 0',
      error_message: 'Security quantity must be greater than zero',
      affected_fields: ['SFTR_019']
    },
    {
      rule_id: 'SFTR_VR036',
      name: 'Price Non-Negative',
      description: 'Security price must be non-negative',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Security_Price >= 0',
      error_message: 'Security price cannot be negative',
      affected_fields: ['SFTR_020']
    },
    {
      rule_id: 'SFTR_VR037',
      name: 'Broker LEI When Intermediated',
      description: 'Broker LEI required when transaction is intermediated',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Intermediary_Indicator = true THEN Broker_LEI is not empty',
      error_message: 'Broker LEI required for intermediated transactions',
      affected_fields: ['SFTR_034']
    },
    {
      rule_id: 'SFTR_VR038',
      name: 'Buy-Sell Back Price Consistency',
      description: 'For buy-sell back, forward price must be greater than spot price',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF SFT_Type = BSBA THEN Forward_Price >= Spot_Price',
      error_message: 'Forward price should typically be >= spot price for buy-sell back',
      affected_fields: ['SFTR_005', 'SFTR_012']
    },
    {
      rule_id: 'SFTR_VR039',
      name: 'Collateral Availability Date',
      description: 'Collateral availability date must be on or after value date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Collateral_Availability_Date >= Value_Date',
      error_message: 'Collateral availability date must be on or after value date',
      affected_fields: ['SFTR_009']
    },
    {
      rule_id: 'SFTR_VR040',
      name: 'Minimum Termination Notice Valid',
      description: 'Minimum termination notice must be non-negative',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Min_Notice_Period >= 0',
      error_message: 'Minimum notice period cannot be negative',
      affected_fields: ['SFTR_036']
    },
    {
      rule_id: 'SFTR_VR041',
      name: 'Counterparty LEIs Different',
      description: 'Reporting and other counterparty LEIs must be different',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Reporting_Counterparty_LEI != Other_Counterparty_LEI',
      error_message: 'Reporting and other counterparty LEIs must be different',
      affected_fields: ['SFTR_002', 'SFTR_003']
    },
    {
      rule_id: 'SFTR_VR042',
      name: 'Sector Code Valid',
      description: 'Sector classification must be valid NACE/GICS code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Sector_Code IN valid_sector_codes',
      error_message: 'Invalid sector classification code',
      affected_fields: ['SFTR_030']
    },
    {
      rule_id: 'SFTR_VR043',
      name: 'Margin Type Valid',
      description: 'Margin type must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Margin_Type IN [SICA, SIUR, CASH, SECU, BOTH]',
      error_message: 'Invalid margin type',
      affected_fields: ['SFTR_024']
    },
    {
      rule_id: 'SFTR_VR044',
      name: 'Reporting Counterparty Side Valid',
      description: 'Reporting counterparty side must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Reporting_Side IN [LEND, BORR]',
      error_message: 'Reporting counterparty side must be LEND or BORR',
      affected_fields: ['SFTR_028']
    },
    {
      rule_id: 'SFTR_VR045',
      name: 'Collateral Pool Identifier',
      description: 'Collateral pool must have valid identifier when applicable',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Collateral_Pool = true THEN Pool_Identifier is not empty',
      error_message: 'Pool identifier required when using collateral pool',
      affected_fields: ['SFTR_018']
    },
    {
      rule_id: 'SFTR_VR046',
      name: 'Corporate Action Indicator',
      description: 'Corporate action type required when indicator is set',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Corporate_Action = true THEN Action_Type_Code is not empty',
      error_message: 'Corporate action type code required',
      affected_fields: ['SFTR_037']
    },
    {
      rule_id: 'SFTR_VR047',
      name: 'Settlement Date Sequence',
      description: 'Settlement date must be on or after execution date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Settlement_Date >= Execution_Date',
      error_message: 'Settlement date must be on or after execution date',
      affected_fields: ['SFTR_008', 'SFTR_009']
    },
    {
      rule_id: 'SFTR_VR048',
      name: 'Reinvestment Cash Flag Consistency',
      description: 'Reinvestment details required when cash reinvestment flag is set',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Reinvestment_Flag = true THEN Reinvestment_Type is not empty',
      error_message: 'Reinvestment type required when reinvestment flag is set',
      affected_fields: ['SFTR_036']
    },
    {
      rule_id: 'SFTR_VR049',
      name: 'Unique Transaction Reference',
      description: 'UTI must be unique within reporting entity scope',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'UTI is unique per Reporting_Entity',
      error_message: 'Duplicate UTI detected for reporting entity',
      affected_fields: ['SFTR_004']
    },
    {
      rule_id: 'SFTR_VR050',
      name: 'Modification Reason Required',
      description: 'Modification reason required for MODI action type',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = MODI THEN Modification_Reason is not empty',
      error_message: 'Modification reason required for modification reports',
      affected_fields: ['SFTR_007']
    }
  ]
};

// =============================================================================
// CFTC Package (US)
// =============================================================================
export const CFTC_PACKAGE: RegulationPackage = {
  package_id: 'cftc-rewrite-2024',
  regulation_code: 'CFTC',
  regulation_name: 'CFTC Swap Data Reporting',
  version: '3.2',
  effective_date: '2024-01-29',
  description: 'CFTC swap data reporting requirements under Part 43 (real-time) and Part 45 (regulatory). Includes Creation, Continuation, State, and Valuation data.',
  jurisdiction: 'US',
  reporting_authority: 'CFTC',
  field_count: 128,
  mandatory_fields: 85,
  conditional_fields: 30,
  optional_fields: 13,
  validation_rule_count: 40,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:cftc:swap:data:reporting',
  output_root_element: 'SwapDataReport',
  tags: ['derivatives', 'swaps', 'OTC', 'CFTC', 'US', 'UPI'],
  report_types: [
    {
      code: 'CREATION',
      name: 'Swap Creation Data',
      description: 'Primary economic terms at swap inception (Part 45.3)',
      action_types: ['SNEW'],
      field_count: 95
    },
    {
      code: 'CONTINUATION',
      name: 'Swap Continuation Data',
      description: 'Lifecycle events including modifications, terminations, novations (Part 45.4)',
      action_types: ['MODI', 'TERM', 'NOVA', 'COMP', 'CORR', 'EROR'],
      field_count: 85
    },
    {
      code: 'STATE',
      name: 'State Data',
      description: 'Daily state/position data for outstanding swaps (Part 45.4)',
      action_types: ['STAT'],
      field_count: 60
    },
    {
      code: 'VALUATION',
      name: 'Valuation Data',
      description: 'Daily valuations for non-cleared swaps (Part 45.4)',
      action_types: ['VALU'],
      field_count: 28
    }
  ],
  fields: [
    {
      field_id: 'CFTC_001',
      field_name: 'Reporting Entity ID',
      description: 'LEI of the reporting counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgCtrPtyId',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM']
    },
    {
      field_id: 'CFTC_002',
      field_name: 'Non-Reporting Counterparty ID',
      description: 'LEI of the non-reporting counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'NonRptgCtrPtyId',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'CFTC_003',
      field_name: 'USI',
      description: 'Unique Swap Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 42,
      pattern: '^[A-Z0-9]{1,42}$',
      cdm_path: 'trade_event.uti',
      xml_element: 'USI',
      validation_rules: ['USI_FORMAT']
    },
    {
      field_id: 'CFTC_004',
      field_name: 'UPI',
      description: 'Unique Product Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      pattern: '^[A-Z0-9]{12}$',
      cdm_path: 'product.upi',
      xml_element: 'UPI',
      validation_rules: ['UPI_FORMAT']
    },
    {
      field_id: 'CFTC_005',
      field_name: 'Action Type',
      description: 'Type of action',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR', 'REVI', 'VALU', 'MARU', 'PRTO', 'POSC'],
      cdm_path: 'trade_event.action_type',
      xml_element: 'ActnTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'CFTC_006',
      field_name: 'Event Type',
      description: 'Type of lifecycle event',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['TRAD', 'NOVA', 'COMP', 'ETRM', 'CLRG', 'EXER', 'ALOC', 'CREV', 'PTNG'],
      cdm_path: 'trade_event.event_type',
      xml_element: 'EvtTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'CFTC_007',
      field_name: 'Execution Timestamp',
      description: 'Date and time of execution',
      data_type: 'datetime',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$',
      cdm_path: 'execution.execution_timestamp',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['ISO_DATETIME']
    },
    {
      field_id: 'CFTC_008',
      field_name: 'Effective Date',
      description: 'Effective date of the swap',
      data_type: 'date',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      cdm_path: 'product.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'CFTC_009',
      field_name: 'Maturity Date',
      description: 'Maturity date of the swap',
      data_type: 'date',
      requirement: 'mandatory',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      cdm_path: 'product.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'CFTC_010',
      field_name: 'Notional Amount',
      description: 'Notional amount of leg 1',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.notional_amount',
      xml_element: 'NtnlAmt',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'CFTC_011',
      field_name: 'Notional Currency',
      description: 'Currency of notional amount',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'CFTC_012',
      field_name: 'Asset Class',
      description: 'Asset class of the swap',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['CR', 'CO', 'EQ', 'FX', 'IR'],
      cdm_path: 'product.asset_class',
      xml_element: 'AsstClss',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'CFTC_013',
      field_name: 'Cleared',
      description: 'Whether the swap is cleared',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.cleared',
      xml_element: 'Clrd',
      validation_rules: []
    },
    {
      field_id: 'CFTC_014',
      field_name: 'CCP ID',
      description: 'LEI of the CCP if cleared',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required if Cleared = true',
      cdm_path: 'parties[role=CCP].lei',
      xml_element: 'CCPId',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'CFTC_015',
      field_name: 'Platform ID',
      description: 'LEI of the execution platform',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required if executed on platform',
      cdm_path: 'execution.platform_lei',
      xml_element: 'PltfrmId',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'CFTC_016',
      field_name: 'Block Trade',
      description: 'Whether this is a block trade',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'execution.block_trade',
      xml_element: 'BlckTrad',
      validation_rules: []
    },
    {
      field_id: 'CFTC_017',
      field_name: 'Price',
      description: 'Price of the swap',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.price',
      xml_element: 'Pric',
      validation_rules: []
    },
    {
      field_id: 'CFTC_018',
      field_name: 'Price Currency',
      description: 'Currency of the price',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.price_currency',
      xml_element: 'PricCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'CFTC_019',
      field_name: 'Collateralized',
      description: 'Collateralization indicator',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['FC', 'OC', 'PC', 'UC'],
      cdm_path: 'trade_event.collateralization',
      xml_element: 'Coll',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'CFTC_020',
      field_name: 'Initial Margin Posted',
      description: 'Initial margin posted by reporting party',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required if collateralized',
      cdm_path: 'valuation.initial_margin_posted',
      xml_element: 'InitlMrgnPstd',
      validation_rules: ['NON_NEGATIVE']
    }
  ],
  validation_rules: [
    {
      rule_id: 'CFTC_VR001',
      name: 'LEI Format',
      description: 'LEI must be exactly 20 alphanumeric characters',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{20}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['CFTC_001', 'CFTC_002', 'CFTC_014', 'CFTC_015']
    },
    {
      rule_id: 'CFTC_VR002',
      name: 'UPI Required',
      description: 'UPI is mandatory for all swaps as of January 2024',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'UPI is not empty',
      error_message: 'UPI is required',
      affected_fields: ['CFTC_004']
    },
    {
      rule_id: 'CFTC_VR003',
      name: 'CCP Required for Cleared',
      description: 'CCP ID required when swap is cleared',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Cleared = true THEN CCP_ID is not empty',
      error_message: 'CCP ID required for cleared swaps',
      affected_fields: ['CFTC_013', 'CFTC_014']
    },
    {
      rule_id: 'CFTC_VR004',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Effective_Date',
      error_message: 'Maturity date must be after effective date',
      affected_fields: ['CFTC_008', 'CFTC_009']
    },
    {
      rule_id: 'CFTC_VR005',
      name: 'Notional Positive',
      description: 'Notional amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be greater than zero',
      affected_fields: ['CFTC_010']
    },
    {
      rule_id: 'CFTC_VR006',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['CFTC_001', 'CFTC_002', 'CFTC_014', 'CFTC_015']
    },
    {
      rule_id: 'CFTC_VR007',
      name: 'USI Format Validation',
      description: 'USI must be valid format per CFTC requirements',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'USI matches ^[A-Z0-9]{10,52}$',
      error_message: 'Invalid USI format',
      affected_fields: ['CFTC_003']
    },
    {
      rule_id: 'CFTC_VR008',
      name: 'UPI Format Validation',
      description: 'UPI must be valid 12-character format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UPI matches ^[A-Z0-9]{12}$',
      error_message: 'Invalid UPI format',
      affected_fields: ['CFTC_004']
    },
    {
      rule_id: 'CFTC_VR009',
      name: 'ISO Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN iso_4217_codes',
      error_message: 'Invalid ISO 4217 currency code',
      affected_fields: ['CFTC_011', 'CFTC_018']
    },
    {
      rule_id: 'CFTC_VR010',
      name: 'Execution Date Not Future',
      description: 'Execution timestamp cannot be in the future',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Execution_Timestamp <= current_datetime',
      error_message: 'Execution timestamp cannot be in the future',
      affected_fields: ['CFTC_006']
    },
    {
      rule_id: 'CFTC_VR011',
      name: 'T+2 Reporting Deadline',
      description: 'Swaps must be reported within T+2 of execution',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Reporting_Timestamp <= Execution_Timestamp + 2 business days',
      error_message: 'Swap should be reported within T+2',
      affected_fields: ['CFTC_006']
    },
    {
      rule_id: 'CFTC_VR012',
      name: 'Action Type Valid',
      description: 'Action type must be valid CFTC enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Action_Type IN [SNEW, MODI, TERM, NOVA, COMP, CORR, EROR]',
      error_message: 'Invalid action type for CFTC reporting',
      affected_fields: ['CFTC_005']
    },
    {
      rule_id: 'CFTC_VR013',
      name: 'Event Type Valid',
      description: 'Event type must be valid CFTC enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Event_Type IN [TRAD, NOVA, COMP, ETRM, CLRG, EXER, MATU]',
      error_message: 'Invalid event type',
      affected_fields: ['CFTC_007']
    },
    {
      rule_id: 'CFTC_VR014',
      name: 'Counterparty LEIs Different',
      description: 'Reporting and counterparty LEIs must be different',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Reporting_LEI != Counterparty_LEI',
      error_message: 'Reporting and counterparty LEIs must be different',
      affected_fields: ['CFTC_001', 'CFTC_002']
    },
    {
      rule_id: 'CFTC_VR015',
      name: 'SDR Required',
      description: 'Swap Data Repository must be identified',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'SDR_ID is not empty',
      error_message: 'SDR identifier is required',
      affected_fields: ['CFTC_016']
    },
    {
      rule_id: 'CFTC_VR016',
      name: 'Platform ID When Executed On SEF',
      description: 'Platform ID required when executed on SEF/DCM',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Execution_Venue != OTC THEN Platform_ID is not empty',
      error_message: 'Platform ID required for SEF/DCM executed swaps',
      affected_fields: ['CFTC_017']
    },
    {
      rule_id: 'CFTC_VR017',
      name: 'Block Trade Indicator',
      description: 'Block trade fields required when indicator is true',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Block_Trade = true THEN Block_Trade_Details is not empty',
      error_message: 'Block trade details required when block trade indicator is set',
      affected_fields: ['CFTC_019']
    },
    {
      rule_id: 'CFTC_VR018',
      name: 'Large Notional Off-Facility Indicator',
      description: 'LNOF indicator required for large notional swaps',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Notional > LNOF_Threshold THEN LNOF_Indicator is not empty',
      error_message: 'Large notional off-facility indicator may be required',
      affected_fields: ['CFTC_010', 'CFTC_020']
    },
    {
      rule_id: 'CFTC_VR019',
      name: 'Price Notation Valid',
      description: 'Price notation must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Price_Notation IN [PERC, DCML, SPRD, BPNT]',
      error_message: 'Invalid price notation',
      affected_fields: ['CFTC_012']
    },
    {
      rule_id: 'CFTC_VR020',
      name: 'Valuation Amount Non-Negative',
      description: 'Valuation amount must be non-negative',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'ABS(Valuation_Amount) >= 0',
      error_message: 'Invalid valuation amount',
      affected_fields: ['CFTC_021']
    },
    {
      rule_id: 'CFTC_VR021',
      name: 'Valuation Currency Required',
      description: 'Currency required when valuation is provided',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Valuation_Amount is not empty THEN Valuation_Currency is not empty',
      error_message: 'Valuation currency required when valuation is provided',
      affected_fields: ['CFTC_021', 'CFTC_022']
    },
    {
      rule_id: 'CFTC_VR022',
      name: 'Clearing Requirement Flag',
      description: 'Clearing requirement determination must be provided',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'Clearing_Requirement_Exemption is not empty',
      error_message: 'Clearing requirement exemption status required',
      affected_fields: ['CFTC_023']
    },
    {
      rule_id: 'CFTC_VR023',
      name: 'End User Exception',
      description: 'End user exception details required when claimed',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF End_User_Exception = true THEN Exception_Type is not empty',
      error_message: 'Exception type required when end user exception is claimed',
      affected_fields: ['CFTC_024']
    },
    {
      rule_id: 'CFTC_VR024',
      name: 'Inter-Affiliate Indicator',
      description: 'Inter-affiliate details required when indicator is set',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Inter_Affiliate = true THEN Affiliate_LEI is not empty',
      error_message: 'Affiliate LEI required for inter-affiliate swaps',
      affected_fields: ['CFTC_025']
    },
    {
      rule_id: 'CFTC_VR025',
      name: 'Submission Timestamp',
      description: 'Submission timestamp required and must be valid',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'Submission_Timestamp matches ISO datetime',
      error_message: 'Invalid submission timestamp format',
      affected_fields: ['CFTC_026']
    },
    {
      rule_id: 'CFTC_VR026',
      name: 'Reporting Side Valid',
      description: 'Reporting side must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Reporting_Side IN [BUYR, SELR]',
      error_message: 'Reporting side must be BUYR or SELR',
      affected_fields: ['CFTC_027']
    },
    {
      rule_id: 'CFTC_VR027',
      name: 'Day Count Convention',
      description: 'Day count convention must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Day_Count IN [A360, A365, A365F, 30360, 30E360, ACT/ACT]',
      error_message: 'Invalid day count convention',
      affected_fields: ['CFTC_028']
    },
    {
      rule_id: 'CFTC_VR028',
      name: 'Payment Frequency Valid',
      description: 'Payment frequency must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Payment_Frequency IN [DAIL, WEEK, MNTH, QURT, SEMI, YEAR, TERM]',
      error_message: 'Invalid payment frequency',
      affected_fields: ['CFTC_029']
    },
    {
      rule_id: 'CFTC_VR029',
      name: 'Rate Reset Frequency',
      description: 'Reset frequency valid for floating rate swaps',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Rate_Type = FLOAT THEN Reset_Frequency is not empty',
      error_message: 'Reset frequency required for floating rate leg',
      affected_fields: ['CFTC_030']
    },
    {
      rule_id: 'CFTC_VR030',
      name: 'Floating Rate Index',
      description: 'Floating rate index required for floating legs',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Rate_Type = FLOAT THEN Floating_Rate_Index is not empty',
      error_message: 'Floating rate index required for floating rate leg',
      affected_fields: ['CFTC_031']
    },
    {
      rule_id: 'CFTC_VR031',
      name: 'Spread Reasonable',
      description: 'Spread over benchmark within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Spread >= -500 AND Spread <= 1000 basis points',
      error_message: 'Spread outside reasonable bounds',
      affected_fields: ['CFTC_032']
    },
    {
      rule_id: 'CFTC_VR032',
      name: 'Fixed Rate Reasonable',
      description: 'Fixed rate must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Fixed_Rate >= -5 AND Fixed_Rate <= 30',
      error_message: 'Fixed rate outside reasonable bounds',
      affected_fields: ['CFTC_033']
    },
    {
      rule_id: 'CFTC_VR033',
      name: 'Option Style Valid',
      description: 'Option style must be valid for swaptions',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'IF Product_Class = SWAPTION THEN Option_Style IN [AMER, EURO, BERM]',
      error_message: 'Invalid option style for swaption',
      affected_fields: ['CFTC_034']
    },
    {
      rule_id: 'CFTC_VR034',
      name: 'Option Expiry Before Underlying Maturity',
      description: 'Option expiry must be before underlying swap maturity',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Product_Class = SWAPTION THEN Option_Expiry <= Maturity_Date',
      error_message: 'Option expiry must be on or before underlying maturity',
      affected_fields: ['CFTC_035', 'CFTC_009']
    },
    {
      rule_id: 'CFTC_VR035',
      name: 'Strike Price Required for Options',
      description: 'Strike price required for option products',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Product_Class IN [SWAPTION, CAP, FLOOR] THEN Strike_Price is not empty',
      error_message: 'Strike price required for option products',
      affected_fields: ['CFTC_036']
    },
    {
      rule_id: 'CFTC_VR036',
      name: 'Compression Indicator',
      description: 'Original USI required for compression trades',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = COMP THEN Original_USI is not empty',
      error_message: 'Original USI required for compression trades',
      affected_fields: ['CFTC_005', 'CFTC_037']
    },
    {
      rule_id: 'CFTC_VR037',
      name: 'Novation LEIs',
      description: 'Transferor and transferee LEIs required for novations',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Event_Type = NOVA THEN Transferor_LEI AND Transferee_LEI are not empty',
      error_message: 'Transferor and transferee LEIs required for novations',
      affected_fields: ['CFTC_038', 'CFTC_039']
    },
    {
      rule_id: 'CFTC_VR038',
      name: 'Dealer/MSP Indicator',
      description: 'Dealer status must be indicated',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'SD_MSP_Indicator is not empty',
      error_message: 'Swap Dealer/MSP indicator required',
      affected_fields: ['CFTC_040']
    },
    {
      rule_id: 'CFTC_VR039',
      name: 'Financial Entity Classification',
      description: 'Financial entity classification required',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Entity_Classification IN [SD, MSP, FINL, NFIN]',
      error_message: 'Invalid financial entity classification',
      affected_fields: ['CFTC_041']
    },
    {
      rule_id: 'CFTC_VR040',
      name: 'Unique USI Within SDR',
      description: 'USI must be unique within the SDR',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'USI is unique per SDR',
      error_message: 'Duplicate USI detected within SDR',
      affected_fields: ['CFTC_003']
    }
  ]
};

// =============================================================================
// JFSA Package (Japan)
// =============================================================================
export const JFSA_PACKAGE: RegulationPackage = {
  package_id: 'jfsa-2024',
  regulation_code: 'JFSA',
  regulation_name: 'Japan Financial Services Agency OTC Derivatives Reporting',
  version: '2.0',
  effective_date: '2024-04-01',
  description: 'Japanese OTC derivatives transaction reporting requirements. Includes Trade, Position, and Valuation reports aligned with global standards.',
  jurisdiction: 'JP',
  reporting_authority: 'JFSA',
  field_count: 95,
  mandatory_fields: 65,
  conditional_fields: 22,
  optional_fields: 8,
  validation_rule_count: 35,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:jfsa:otc:derivatives:reporting',
  output_root_element: 'DerivativesReport',
  tags: ['derivatives', 'OTC', 'JFSA', 'Japan', 'Asia'],
  report_types: [
    {
      code: 'TRADE',
      name: 'Trade Report',
      description: 'New trades, amendments, and lifecycle events',
      action_types: ['NEWT', 'MODI', 'CORR', 'TERM'],
      field_count: 75
    },
    {
      code: 'POSITION',
      name: 'Position Report',
      description: 'Daily outstanding position data',
      action_types: ['POSC'],
      field_count: 50
    },
    {
      code: 'VALUATION',
      name: 'Valuation Report',
      description: 'Daily mark-to-market valuations',
      action_types: ['VALU'],
      field_count: 25
    }
  ],
  fields: [
    {
      field_id: 'JFSA_001',
      field_name: 'Reporting Entity LEI',
      description: 'LEI of the reporting entity',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgNttyLEI',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM']
    },
    {
      field_id: 'JFSA_002',
      field_name: 'Counterparty LEI',
      description: 'LEI of the counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'CtrPtyLEI',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'JFSA_003',
      field_name: 'UTI',
      description: 'Unique Transaction Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      cdm_path: 'trade_event.uti',
      xml_element: 'UTI',
      validation_rules: ['UTI_FORMAT']
    },
    {
      field_id: 'JFSA_004',
      field_name: 'UPI',
      description: 'Unique Product Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      cdm_path: 'product.upi',
      xml_element: 'UPI',
      validation_rules: ['UPI_FORMAT']
    },
    {
      field_id: 'JFSA_005',
      field_name: 'Action Type',
      description: 'Type of action',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR', 'REVI', 'VALU'],
      cdm_path: 'trade_event.action_type',
      xml_element: 'ActnTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'JFSA_006',
      field_name: 'Event Type',
      description: 'Lifecycle event type',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['TRAD', 'NOVA', 'COMP', 'ETRM', 'CLRG', 'EXER'],
      cdm_path: 'trade_event.event_type',
      xml_element: 'EvtTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'JFSA_007',
      field_name: 'Execution Timestamp',
      description: 'Timestamp of execution in JST',
      data_type: 'datetime',
      requirement: 'mandatory',
      cdm_path: 'execution.execution_timestamp',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['ISO_DATETIME']
    },
    {
      field_id: 'JFSA_008',
      field_name: 'Effective Date',
      description: 'Effective date of the transaction',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'JFSA_009',
      field_name: 'Maturity Date',
      description: 'Maturity date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'JFSA_010',
      field_name: 'Notional Amount',
      description: 'Notional amount',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.notional_amount',
      xml_element: 'NtnlAmt',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'JFSA_011',
      field_name: 'Notional Currency',
      description: 'Currency of notional',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'JFSA_012',
      field_name: 'Asset Class',
      description: 'Asset class',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['IR', 'CR', 'FX', 'CO', 'EQ'],
      cdm_path: 'product.asset_class',
      xml_element: 'AsstClss',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'JFSA_013',
      field_name: 'Product Type',
      description: 'Type of derivative product',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['SWAP', 'OPTN', 'FWRD', 'FUTR', 'SWPT', 'XCCY', 'CDS', 'OTHR'],
      cdm_path: 'product.product_type',
      xml_element: 'PdctTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'JFSA_014',
      field_name: 'Cleared',
      description: 'Clearing status',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.cleared',
      xml_element: 'Clrd',
      validation_rules: []
    },
    {
      field_id: 'JFSA_015',
      field_name: 'CCP LEI',
      description: 'LEI of the CCP',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required if cleared',
      cdm_path: 'parties[role=CCP].lei',
      xml_element: 'CCPId',
      validation_rules: ['LEI_FORMAT']
    }
  ],
  validation_rules: [
    {
      rule_id: 'JFSA_VR001',
      name: 'LEI Format',
      description: 'LEI must be 20 characters',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{20}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['JFSA_001', 'JFSA_002', 'JFSA_015']
    },
    {
      rule_id: 'JFSA_VR002',
      name: 'UPI Required',
      description: 'UPI is mandatory',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'UPI is not empty',
      error_message: 'UPI is required',
      affected_fields: ['JFSA_004']
    },
    {
      rule_id: 'JFSA_VR003',
      name: 'CCP for Cleared',
      description: 'CCP LEI required for cleared transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Cleared = true THEN CCP_LEI is not empty',
      error_message: 'CCP LEI required when cleared',
      affected_fields: ['JFSA_014', 'JFSA_015']
    },
    {
      rule_id: 'JFSA_VR004',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['JFSA_001', 'JFSA_002', 'JFSA_015']
    },
    {
      rule_id: 'JFSA_VR005',
      name: 'UTI Format Validation',
      description: 'UTI must be valid format per ISO 23897',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UTI matches ^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      error_message: 'Invalid UTI format',
      affected_fields: ['JFSA_003']
    },
    {
      rule_id: 'JFSA_VR006',
      name: 'UPI Format Validation',
      description: 'UPI must be valid 12-character format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UPI matches ^[A-Z0-9]{12}$',
      error_message: 'Invalid UPI format',
      affected_fields: ['JFSA_004']
    },
    {
      rule_id: 'JFSA_VR007',
      name: 'ISO Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN iso_4217_codes',
      error_message: 'Invalid ISO 4217 currency code',
      affected_fields: ['JFSA_011', 'JFSA_013']
    },
    {
      rule_id: 'JFSA_VR008',
      name: 'Execution Date Not Future',
      description: 'Execution timestamp cannot be in the future (JST)',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Execution_Timestamp <= current_datetime_jst',
      error_message: 'Execution timestamp cannot be in the future',
      affected_fields: ['JFSA_007']
    },
    {
      rule_id: 'JFSA_VR009',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Effective_Date',
      error_message: 'Maturity date must be after effective date',
      affected_fields: ['JFSA_008', 'JFSA_009']
    },
    {
      rule_id: 'JFSA_VR010',
      name: 'Notional Amount Positive',
      description: 'Notional amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be positive',
      affected_fields: ['JFSA_010']
    },
    {
      rule_id: 'JFSA_VR011',
      name: 'Action Type Valid',
      description: 'Action type must be valid JFSA enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Action_Type IN [NEWT, MODI, CORR, TERM, EROR, REVI, VALU]',
      error_message: 'Invalid action type for JFSA reporting',
      affected_fields: ['JFSA_005']
    },
    {
      rule_id: 'JFSA_VR012',
      name: 'Event Type Valid',
      description: 'Event type must be valid JFSA enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Event_Type IN [TRAD, NOVA, COMP, ETRM, CLRG, EXER]',
      error_message: 'Invalid event type',
      affected_fields: ['JFSA_006']
    },
    {
      rule_id: 'JFSA_VR013',
      name: 'Counterparty LEIs Different',
      description: 'Reporting and counterparty LEIs must be different',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Reporting_LEI != Counterparty_LEI',
      error_message: 'Reporting and counterparty LEIs must be different',
      affected_fields: ['JFSA_001', 'JFSA_002']
    },
    {
      rule_id: 'JFSA_VR014',
      name: 'T+1 Reporting Deadline',
      description: 'Transactions must be reported within T+1 (JST)',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Reporting_Timestamp <= Execution_Timestamp + 1 business day JST',
      error_message: 'Transaction should be reported within T+1',
      affected_fields: ['JFSA_007']
    },
    {
      rule_id: 'JFSA_VR015',
      name: 'ISIN Format Validation',
      description: 'ISIN must be valid format per ISO 6166',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'ISIN matches ^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      error_message: 'Invalid ISIN format',
      affected_fields: ['JFSA_016']
    },
    {
      rule_id: 'JFSA_VR016',
      name: 'ISIN Checksum Validation',
      description: 'ISIN must pass Luhn checksum',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'isin_luhn_valid(ISIN)',
      error_message: 'Invalid ISIN checksum',
      affected_fields: ['JFSA_016']
    },
    {
      rule_id: 'JFSA_VR017',
      name: 'Valuation Amount Non-Negative',
      description: 'Valuation must be a valid number',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'ABS(Valuation_Amount) >= 0',
      error_message: 'Invalid valuation amount',
      affected_fields: ['JFSA_017']
    },
    {
      rule_id: 'JFSA_VR018',
      name: 'Valuation Currency Required',
      description: 'Currency required when valuation is provided',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Valuation_Amount is not empty THEN Valuation_Currency is not empty',
      error_message: 'Valuation currency required when valuation is provided',
      affected_fields: ['JFSA_017', 'JFSA_018']
    },
    {
      rule_id: 'JFSA_VR019',
      name: 'Product Classification Valid',
      description: 'Product classification must be valid JFSA category',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Product_Class IN [IR, CR, EQ, FX, CO]',
      error_message: 'Invalid product classification',
      affected_fields: ['JFSA_019']
    },
    {
      rule_id: 'JFSA_VR020',
      name: 'Day Count Convention Valid',
      description: 'Day count convention must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Day_Count IN [A360, A365, A365F, 30360, 30E360, ACT/ACT]',
      error_message: 'Invalid day count convention',
      affected_fields: ['JFSA_020']
    },
    {
      rule_id: 'JFSA_VR021',
      name: 'Payment Frequency Valid',
      description: 'Payment frequency must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Payment_Frequency IN [DAIL, WEEK, MNTH, QURT, SEMI, YEAR, TERM]',
      error_message: 'Invalid payment frequency',
      affected_fields: ['JFSA_021']
    },
    {
      rule_id: 'JFSA_VR022',
      name: 'Floating Rate Index Required',
      description: 'Floating rate index required for floating rate legs',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Rate_Type = FLOAT THEN Floating_Rate_Index is not empty',
      error_message: 'Floating rate index required for floating rate leg',
      affected_fields: ['JFSA_022']
    },
    {
      rule_id: 'JFSA_VR023',
      name: 'Spread Reasonable',
      description: 'Spread over benchmark must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Spread >= -500 AND Spread <= 1000 basis points',
      error_message: 'Spread outside reasonable bounds',
      affected_fields: ['JFSA_023']
    },
    {
      rule_id: 'JFSA_VR024',
      name: 'Fixed Rate Reasonable',
      description: 'Fixed rate must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Fixed_Rate >= -5 AND Fixed_Rate <= 25',
      error_message: 'Fixed rate outside reasonable bounds',
      affected_fields: ['JFSA_024']
    },
    {
      rule_id: 'JFSA_VR025',
      name: 'Counterparty Classification Required',
      description: 'Counterparty classification required for all transactions',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'Counterparty_Classification is not empty',
      error_message: 'Counterparty classification is required',
      affected_fields: ['JFSA_025']
    },
    {
      rule_id: 'JFSA_VR026',
      name: 'Clearing Status Valid',
      description: 'Clearing status must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Clearing_Status IN [CLRD, NCLR]',
      error_message: 'Invalid clearing status',
      affected_fields: ['JFSA_014']
    },
    {
      rule_id: 'JFSA_VR027',
      name: 'Compression Indicator',
      description: 'Original UTI required for compression trades',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = COMP THEN Original_UTI is not empty',
      error_message: 'Original UTI required for compression trades',
      affected_fields: ['JFSA_005', 'JFSA_026']
    },
    {
      rule_id: 'JFSA_VR028',
      name: 'Novation LEIs Required',
      description: 'Transferor and transferee LEIs required for novations',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Event_Type = NOVA THEN Transferor_LEI AND Transferee_LEI are not empty',
      error_message: 'Transferor and transferee LEIs required for novations',
      affected_fields: ['JFSA_027', 'JFSA_028']
    },
    {
      rule_id: 'JFSA_VR029',
      name: 'Option Style Valid',
      description: 'Option style must be valid for swaptions',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'IF Product_Type = SWAPTION THEN Option_Style IN [AMER, EURO, BERM]',
      error_message: 'Invalid option style for swaption',
      affected_fields: ['JFSA_029']
    },
    {
      rule_id: 'JFSA_VR030',
      name: 'Strike Price Required for Options',
      description: 'Strike price required for option products',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Product_Type IN [SWAPTION, CAP, FLOOR] THEN Strike_Price is not empty',
      error_message: 'Strike price required for option products',
      affected_fields: ['JFSA_030']
    },
    {
      rule_id: 'JFSA_VR031',
      name: 'Barrier Details for Exotic',
      description: 'Barrier level required for barrier options',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Exotic_Type = BARRIER THEN Barrier_Level is not empty',
      error_message: 'Barrier level required for barrier options',
      affected_fields: ['JFSA_031']
    },
    {
      rule_id: 'JFSA_VR032',
      name: 'Unique UTI Within Entity',
      description: 'UTI must be unique within reporting entity scope',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'UTI is unique per Reporting_Entity',
      error_message: 'Duplicate UTI detected for reporting entity',
      affected_fields: ['JFSA_003']
    },
    {
      rule_id: 'JFSA_VR033',
      name: 'Settlement Type Valid',
      description: 'Settlement type must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Settlement_Type IN [PHYS, CASH]',
      error_message: 'Invalid settlement type',
      affected_fields: ['JFSA_032']
    },
    {
      rule_id: 'JFSA_VR034',
      name: 'Master Agreement Type',
      description: 'Master agreement type must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Master_Agreement IN [ISDA, OTHER]',
      error_message: 'Invalid master agreement type',
      affected_fields: ['JFSA_033']
    },
    {
      rule_id: 'JFSA_VR035',
      name: 'Collateral Portfolio Required',
      description: 'Collateral portfolio code required when collateralized',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Collateralized = true THEN Collateral_Portfolio is not empty',
      error_message: 'Collateral portfolio code required',
      affected_fields: ['JFSA_034']
    }
  ]
};

// =============================================================================
// UK EMIR Package
// =============================================================================
export const UK_EMIR_PACKAGE: RegulationPackage = {
  package_id: 'uk-emir-2024',
  regulation_code: 'UK_EMIR',
  regulation_name: 'UK European Market Infrastructure Regulation',
  version: 'Refit 1.0',
  effective_date: '2024-09-30',
  description: 'UK EMIR reporting requirements for OTC derivatives post-Brexit, aligned with UK FCA requirements. Supports Trade State, Position, Valuation, and Margin reports.',
  jurisdiction: 'GB',
  reporting_authority: 'FCA',
  field_count: 203,
  mandatory_fields: 130,
  conditional_fields: 55,
  optional_fields: 18,
  validation_rule_count: 42,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:fca:emir:reporting',
  output_root_element: 'Document',
  tags: ['derivatives', 'OTC', 'FCA', 'UK', 'post-Brexit'],
  report_types: [
    {
      code: 'TRADE',
      name: 'Trade State Report',
      description: 'Report new trades, modifications, corrections, and terminations',
      action_types: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR', 'REVI'],
      field_count: 128
    },
    {
      code: 'POSITION',
      name: 'Position Report',
      description: 'Daily outstanding positions for OTC derivatives',
      action_types: ['POSC'],
      field_count: 85
    },
    {
      code: 'VALUATION',
      name: 'Valuation Report',
      description: 'Daily mark-to-market or mark-to-model valuations',
      action_types: ['VALU'],
      field_count: 32
    },
    {
      code: 'MARGIN',
      name: 'Margin Report',
      description: 'Collateral and margin data for non-centrally cleared derivatives',
      action_types: ['MARU'],
      field_count: 38
    }
  ],
  fields: [
    {
      field_id: 'UKEMIR_001',
      field_name: 'Report Submitting Entity ID',
      description: 'LEI of the entity submitting the report',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'trade_event.reporting_counterparty.lei',
      xml_element: 'RptSubmitgNtty',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM']
    },
    {
      field_id: 'UKEMIR_002',
      field_name: 'Reporting Counterparty ID',
      description: 'LEI of the reporting counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgCtrPty',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM']
    },
    {
      field_id: 'UKEMIR_003',
      field_name: 'Other Counterparty ID',
      description: 'LEI of the other counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'OthrCtrPty',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'UKEMIR_004',
      field_name: 'UTI',
      description: 'Unique Transaction Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      cdm_path: 'trade_event.uti',
      xml_element: 'UnqTxIdr',
      validation_rules: ['UTI_FORMAT']
    },
    {
      field_id: 'UKEMIR_005',
      field_name: 'UPI',
      description: 'Unique Product Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      cdm_path: 'product.upi',
      xml_element: 'UPI',
      validation_rules: ['UPI_FORMAT']
    },
    {
      field_id: 'UKEMIR_006',
      field_name: 'Action Type',
      description: 'Type of action',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'CANC', 'TERM', 'EROR', 'REVI', 'VALU', 'COLU', 'MARU', 'PRTO', 'POSC'],
      cdm_path: 'trade_event.action_type',
      xml_element: 'ActnTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'UKEMIR_007',
      field_name: 'Event Type',
      description: 'Lifecycle event type',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['TRAD', 'NOVA', 'COMP', 'ETRM', 'CLRG', 'EXER', 'ALOC', 'CREV', 'PTNG', 'UPDT'],
      cdm_path: 'trade_event.event_type',
      xml_element: 'EvtTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'UKEMIR_008',
      field_name: 'Reporting Timestamp',
      description: 'Timestamp of report submission',
      data_type: 'datetime',
      requirement: 'mandatory',
      cdm_path: 'trade_event.reporting_timestamp',
      xml_element: 'RptgTmStmp',
      validation_rules: ['ISO_DATETIME']
    },
    {
      field_id: 'UKEMIR_009',
      field_name: 'Execution Timestamp',
      description: 'Timestamp of execution',
      data_type: 'datetime',
      requirement: 'mandatory',
      cdm_path: 'execution.execution_timestamp',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['ISO_DATETIME']
    },
    {
      field_id: 'UKEMIR_010',
      field_name: 'Effective Date',
      description: 'Effective date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'UKEMIR_011',
      field_name: 'Maturity Date',
      description: 'Maturity date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'UKEMIR_012',
      field_name: 'Notional Amount 1',
      description: 'Notional amount of leg 1',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.notional_amount',
      xml_element: 'NtnlAmt1',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'UKEMIR_013',
      field_name: 'Notional Currency 1',
      description: 'Currency of leg 1 notional',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy1',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'UKEMIR_014',
      field_name: 'Asset Class',
      description: 'Asset class',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['INTR', 'CRDT', 'EQUI', 'COMM', 'CURR'],
      cdm_path: 'product.asset_class',
      xml_element: 'AsstClss',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'UKEMIR_015',
      field_name: 'Contract Type',
      description: 'Type of contract',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['SWAP', 'OPTN', 'FWRD', 'FUTR', 'SWPT', 'OTHR'],
      cdm_path: 'product.product_type',
      xml_element: 'CtrctTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'UKEMIR_016',
      field_name: 'Cleared',
      description: 'Clearing status',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['Y', 'N', 'I'],
      cdm_path: 'trade_event.cleared',
      xml_element: 'Clrd',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'UKEMIR_017',
      field_name: 'CCP ID',
      description: 'LEI of the CCP',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required if Cleared = Y',
      cdm_path: 'parties[role=CCP].lei',
      xml_element: 'CCPId',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'UKEMIR_018',
      field_name: 'Intragroup',
      description: 'Intragroup transaction indicator',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.intragroup',
      xml_element: 'IntrGrp',
      validation_rules: []
    },
    {
      field_id: 'UKEMIR_019',
      field_name: 'MTM Value',
      description: 'Mark-to-market valuation',
      data_type: 'decimal',
      requirement: 'conditional',
      condition: 'Required for valuation reports',
      cdm_path: 'valuation.mtm_value',
      xml_element: 'MtMVal',
      validation_rules: []
    },
    {
      field_id: 'UKEMIR_020',
      field_name: 'MTM Currency',
      description: 'Currency of MTM value',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      condition: 'Required if MTM Value provided',
      cdm_path: 'valuation.mtm_currency',
      xml_element: 'MtMCcy',
      validation_rules: ['ISO_CURRENCY']
    }
  ],
  validation_rules: [
    {
      rule_id: 'UKEMIR_VR001',
      name: 'LEI Format',
      description: 'LEI must be 20 alphanumeric characters',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{20}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['UKEMIR_001', 'UKEMIR_002', 'UKEMIR_003', 'UKEMIR_017']
    },
    {
      rule_id: 'UKEMIR_VR002',
      name: 'UPI Required',
      description: 'UPI is mandatory',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'UPI is not empty',
      error_message: 'UPI is required',
      affected_fields: ['UKEMIR_005']
    },
    {
      rule_id: 'UKEMIR_VR003',
      name: 'CCP for Cleared',
      description: 'CCP ID required for cleared transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Cleared = Y THEN CCP_ID is not empty',
      error_message: 'CCP ID required when cleared',
      affected_fields: ['UKEMIR_016', 'UKEMIR_017']
    },
    {
      rule_id: 'UKEMIR_VR004',
      name: 'MTM Currency Required',
      description: 'MTM currency required when MTM value provided',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF MTM_Value is not empty THEN MTM_Currency is not empty',
      error_message: 'MTM currency required with MTM value',
      affected_fields: ['UKEMIR_019', 'UKEMIR_020']
    },
    {
      rule_id: 'UKEMIR_VR005',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['UKEMIR_001', 'UKEMIR_002', 'UKEMIR_003', 'UKEMIR_017']
    },
    {
      rule_id: 'UKEMIR_VR006',
      name: 'UTI Format Validation',
      description: 'UTI must be valid format per ISO 23897',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UTI matches ^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      error_message: 'Invalid UTI format',
      affected_fields: ['UKEMIR_004']
    },
    {
      rule_id: 'UKEMIR_VR007',
      name: 'UPI Format Validation',
      description: 'UPI must be valid 12-character format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UPI matches ^[A-Z0-9]{12}$',
      error_message: 'Invalid UPI format',
      affected_fields: ['UKEMIR_005']
    },
    {
      rule_id: 'UKEMIR_VR008',
      name: 'ISO Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN iso_4217_codes',
      error_message: 'Invalid ISO 4217 currency code',
      affected_fields: ['UKEMIR_012', 'UKEMIR_020']
    },
    {
      rule_id: 'UKEMIR_VR009',
      name: 'Execution Date Not Future',
      description: 'Execution timestamp cannot be in the future',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Execution_Timestamp <= current_datetime',
      error_message: 'Execution timestamp cannot be in the future',
      affected_fields: ['UKEMIR_007']
    },
    {
      rule_id: 'UKEMIR_VR010',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Effective_Date',
      error_message: 'Maturity date must be after effective date',
      affected_fields: ['UKEMIR_009', 'UKEMIR_010']
    },
    {
      rule_id: 'UKEMIR_VR011',
      name: 'Notional Amount Positive',
      description: 'Notional amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be positive',
      affected_fields: ['UKEMIR_011']
    },
    {
      rule_id: 'UKEMIR_VR012',
      name: 'Action Type Valid',
      description: 'Action type must be valid UK EMIR enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Action_Type IN [NEWT, MODI, CORR, TERM, EROR, REVI, POSC, VALU, MARU]',
      error_message: 'Invalid action type for UK EMIR reporting',
      affected_fields: ['UKEMIR_006']
    },
    {
      rule_id: 'UKEMIR_VR013',
      name: 'Counterparty LEIs Different',
      description: 'Reporting and other counterparty LEIs must be different',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Reporting_LEI != Other_Counterparty_LEI',
      error_message: 'Reporting and other counterparty LEIs must be different',
      affected_fields: ['UKEMIR_002', 'UKEMIR_003']
    },
    {
      rule_id: 'UKEMIR_VR014',
      name: 'T+1 Reporting Deadline',
      description: 'Transactions must be reported within T+1 per UK EMIR',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Reporting_Timestamp <= Execution_Timestamp + 1 business day',
      error_message: 'Transaction should be reported within T+1',
      affected_fields: ['UKEMIR_007']
    },
    {
      rule_id: 'UKEMIR_VR015',
      name: 'ISIN Format Validation',
      description: 'ISIN must be valid format per ISO 6166',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'ISIN matches ^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      error_message: 'Invalid ISIN format',
      affected_fields: ['UKEMIR_013']
    },
    {
      rule_id: 'UKEMIR_VR016',
      name: 'ISIN Checksum Validation',
      description: 'ISIN must pass Luhn checksum',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'isin_luhn_valid(ISIN)',
      error_message: 'Invalid ISIN checksum',
      affected_fields: ['UKEMIR_013']
    },
    {
      rule_id: 'UKEMIR_VR017',
      name: 'CFI Code Format',
      description: 'CFI code must be valid 6-character format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'CFI matches ^[A-Z]{6}$',
      error_message: 'CFI must be 6 uppercase letters per ISO 10962',
      affected_fields: ['UKEMIR_014']
    },
    {
      rule_id: 'UKEMIR_VR018',
      name: 'MIC Code Validation',
      description: 'Execution venue must be valid ISO 10383 MIC',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'MIC IN iso_10383_mics',
      error_message: 'Invalid MIC code',
      affected_fields: ['UKEMIR_015']
    },
    {
      rule_id: 'UKEMIR_VR019',
      name: 'UK Counterparty Required',
      description: 'At least one counterparty must be UK-based for UK EMIR scope',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'Reporting_Country = GB OR Other_Country = GB',
      error_message: 'UK EMIR reporting may not apply if no UK counterparty',
      affected_fields: ['UKEMIR_002', 'UKEMIR_003']
    },
    {
      rule_id: 'UKEMIR_VR020',
      name: 'Trade Repository LEI',
      description: 'Trade repository must be FCA-registered',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'TR_LEI IN fca_registered_trs',
      error_message: 'Trade repository must be FCA-registered',
      affected_fields: ['UKEMIR_018']
    },
    {
      rule_id: 'UKEMIR_VR021',
      name: 'Counterparty Classification Valid',
      description: 'Counterparty must be classified as FC or NFC',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Classification IN [FC, NFC_PLUS, NFC_MINUS]',
      error_message: 'Invalid counterparty classification',
      affected_fields: ['UKEMIR_021']
    },
    {
      rule_id: 'UKEMIR_VR022',
      name: 'Clearing Obligation Assessment',
      description: 'Clearing obligation status must be provided',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'Clearing_Obligation is not empty',
      error_message: 'Clearing obligation status is required',
      affected_fields: ['UKEMIR_022']
    },
    {
      rule_id: 'UKEMIR_VR023',
      name: 'Intragroup Flag Consistency',
      description: 'Intragroup exemption details required when claimed',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Intragroup = true THEN Intragroup_Exemption_Type is not empty',
      error_message: 'Intragroup exemption type required when intragroup is claimed',
      affected_fields: ['UKEMIR_023']
    },
    {
      rule_id: 'UKEMIR_VR024',
      name: 'Collateral Portfolio Code',
      description: 'Portfolio code required when collateralized',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Collateralized = true THEN Portfolio_Code is not empty',
      error_message: 'Portfolio code required when collateralized',
      affected_fields: ['UKEMIR_024']
    },
    {
      rule_id: 'UKEMIR_VR025',
      name: 'Initial Margin Posted',
      description: 'Initial margin amount must be non-negative',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Initial_Margin_Posted >= 0',
      error_message: 'Initial margin posted cannot be negative',
      affected_fields: ['UKEMIR_025']
    },
    {
      rule_id: 'UKEMIR_VR026',
      name: 'Variation Margin Posted',
      description: 'Variation margin amount must be non-negative',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Variation_Margin_Posted >= 0',
      error_message: 'Variation margin posted cannot be negative',
      affected_fields: ['UKEMIR_026']
    },
    {
      rule_id: 'UKEMIR_VR027',
      name: 'Day Count Convention Valid',
      description: 'Day count convention must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Day_Count IN [A360, A365, A365F, 30360, 30E360, ACT/ACT]',
      error_message: 'Invalid day count convention',
      affected_fields: ['UKEMIR_027']
    },
    {
      rule_id: 'UKEMIR_VR028',
      name: 'Payment Frequency Valid',
      description: 'Payment frequency must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Payment_Frequency IN [DAIL, WEEK, MNTH, QURT, SEMI, YEAR, TERM]',
      error_message: 'Invalid payment frequency',
      affected_fields: ['UKEMIR_028']
    },
    {
      rule_id: 'UKEMIR_VR029',
      name: 'Floating Rate Index Required',
      description: 'Floating rate index required for floating rate legs',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Rate_Type = FLOAT THEN Floating_Rate_Index is not empty',
      error_message: 'Floating rate index required for floating rate leg',
      affected_fields: ['UKEMIR_029']
    },
    {
      rule_id: 'UKEMIR_VR030',
      name: 'SONIA Transition',
      description: 'GBP floating rates should reference SONIA post-LIBOR transition',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Currency = GBP AND Rate_Type = FLOAT THEN Index LIKE SONIA',
      error_message: 'GBP floating rate should reference SONIA',
      affected_fields: ['UKEMIR_029']
    },
    {
      rule_id: 'UKEMIR_VR031',
      name: 'Spread Reasonable',
      description: 'Spread over benchmark must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Spread >= -500 AND Spread <= 1000 basis points',
      error_message: 'Spread outside reasonable bounds',
      affected_fields: ['UKEMIR_030']
    },
    {
      rule_id: 'UKEMIR_VR032',
      name: 'Fixed Rate Reasonable',
      description: 'Fixed rate must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Fixed_Rate >= -5 AND Fixed_Rate <= 25',
      error_message: 'Fixed rate outside reasonable bounds',
      affected_fields: ['UKEMIR_031']
    },
    {
      rule_id: 'UKEMIR_VR033',
      name: 'Compression Indicator',
      description: 'Original UTI required for compression trades',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = COMP THEN Original_UTI is not empty',
      error_message: 'Original UTI required for compression trades',
      affected_fields: ['UKEMIR_006', 'UKEMIR_032']
    },
    {
      rule_id: 'UKEMIR_VR034',
      name: 'Novation LEIs Required',
      description: 'Transferor and transferee LEIs required for novations',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Event_Type = NOVA THEN Transferor_LEI AND Transferee_LEI are not empty',
      error_message: 'Transferor and transferee LEIs required for novations',
      affected_fields: ['UKEMIR_033', 'UKEMIR_034']
    },
    {
      rule_id: 'UKEMIR_VR035',
      name: 'Option Style Valid',
      description: 'Option style must be valid for swaptions',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'IF Product_Type = SWAPTION THEN Option_Style IN [AMER, EURO, BERM]',
      error_message: 'Invalid option style for swaption',
      affected_fields: ['UKEMIR_035']
    },
    {
      rule_id: 'UKEMIR_VR036',
      name: 'Strike Price Required for Options',
      description: 'Strike price required for option products',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Product_Type IN [SWAPTION, CAP, FLOOR] THEN Strike_Price is not empty',
      error_message: 'Strike price required for option products',
      affected_fields: ['UKEMIR_036']
    },
    {
      rule_id: 'UKEMIR_VR037',
      name: 'Option Expiry Before Maturity',
      description: 'Option expiry must be before underlying maturity',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Product_Type = SWAPTION THEN Option_Expiry <= Maturity_Date',
      error_message: 'Option expiry must be on or before underlying maturity',
      affected_fields: ['UKEMIR_037', 'UKEMIR_010']
    },
    {
      rule_id: 'UKEMIR_VR038',
      name: 'Unique UTI Within Entity',
      description: 'UTI must be unique within reporting entity scope',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'UTI is unique per Reporting_Entity',
      error_message: 'Duplicate UTI detected for reporting entity',
      affected_fields: ['UKEMIR_004']
    },
    {
      rule_id: 'UKEMIR_VR039',
      name: 'Master Agreement Type',
      description: 'Master agreement type must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Master_Agreement IN [ISDA, LMA, OTHER]',
      error_message: 'Invalid master agreement type',
      affected_fields: ['UKEMIR_038']
    },
    {
      rule_id: 'UKEMIR_VR040',
      name: 'Confirmation Method',
      description: 'Confirmation method must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Confirmation_Method IN [ELEC, NONELEC]',
      error_message: 'Invalid confirmation method',
      affected_fields: ['UKEMIR_039']
    },
    {
      rule_id: 'UKEMIR_VR041',
      name: 'Trading Capacity Valid',
      description: 'Trading capacity must be principal or agent',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Trading_Capacity IN [PRIN, AGEN]',
      error_message: 'Invalid trading capacity',
      affected_fields: ['UKEMIR_040']
    },
    {
      rule_id: 'UKEMIR_VR042',
      name: 'Position Report Daily',
      description: 'Position reports required daily for open positions',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Position_Report_Date = Previous_Business_Day',
      error_message: 'Position report should be for previous business day',
      affected_fields: ['UKEMIR_041']
    }
  ]
};

// =============================================================================
// ASIC Package (Australia)
// =============================================================================
export const ASIC_PACKAGE: RegulationPackage = {
  package_id: 'asic-2024',
  regulation_code: 'ASIC',
  regulation_name: 'ASIC Derivative Transaction Rules',
  version: 'Rewrite 1.0',
  effective_date: '2024-10-21',
  description: 'Australian OTC derivatives reporting requirements under ASIC Derivative Transaction Rules. Includes Trade, Position, and Valuation reports.',
  jurisdiction: 'AU',
  reporting_authority: 'ASIC',
  field_count: 110,
  mandatory_fields: 75,
  conditional_fields: 28,
  optional_fields: 7,
  validation_rule_count: 30,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:asic:derivatives:reporting',
  output_root_element: 'DerivativesReport',
  tags: ['derivatives', 'OTC', 'ASIC', 'Australia', 'APAC'],
  report_types: [
    {
      code: 'TRADE',
      name: 'Trade Report',
      description: 'New trades and lifecycle events',
      action_types: ['NEWT', 'MODI', 'CORR', 'TERM'],
      field_count: 85
    },
    {
      code: 'POSITION',
      name: 'Position Report',
      description: 'Daily position data',
      action_types: ['POSC'],
      field_count: 55
    },
    {
      code: 'VALUATION',
      name: 'Valuation Report',
      description: 'Daily valuations',
      action_types: ['VALU'],
      field_count: 25
    }
  ],
  fields: [
    {
      field_id: 'ASIC_001',
      field_name: 'Reporting Entity LEI',
      description: 'LEI of the reporting entity',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgNttyLEI',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM']
    },
    {
      field_id: 'ASIC_002',
      field_name: 'Counterparty LEI',
      description: 'LEI of the counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'CtrPtyLEI',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'ASIC_003',
      field_name: 'UTI',
      description: 'Unique Transaction Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      cdm_path: 'trade_event.uti',
      xml_element: 'UTI',
      validation_rules: ['UTI_FORMAT']
    },
    {
      field_id: 'ASIC_004',
      field_name: 'UPI',
      description: 'Unique Product Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      cdm_path: 'product.upi',
      xml_element: 'UPI',
      validation_rules: ['UPI_FORMAT']
    },
    {
      field_id: 'ASIC_005',
      field_name: 'Action Type',
      description: 'Action type',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR', 'REVI', 'VALU'],
      cdm_path: 'trade_event.action_type',
      xml_element: 'ActnTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'ASIC_006',
      field_name: 'Execution Timestamp',
      description: 'Timestamp of execution',
      data_type: 'datetime',
      requirement: 'mandatory',
      cdm_path: 'execution.execution_timestamp',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['ISO_DATETIME']
    },
    {
      field_id: 'ASIC_007',
      field_name: 'Effective Date',
      description: 'Effective date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'ASIC_008',
      field_name: 'Maturity Date',
      description: 'Maturity date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'ASIC_009',
      field_name: 'Notional Amount',
      description: 'Notional amount',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.notional_amount',
      xml_element: 'NtnlAmt',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'ASIC_010',
      field_name: 'Notional Currency',
      description: 'Currency of notional',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'ASIC_011',
      field_name: 'Asset Class',
      description: 'Asset class',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['IR', 'CR', 'FX', 'CO', 'EQ'],
      cdm_path: 'product.asset_class',
      xml_element: 'AsstClss',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'ASIC_012',
      field_name: 'Cleared',
      description: 'Clearing status',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.cleared',
      xml_element: 'Clrd',
      validation_rules: []
    },
    {
      field_id: 'ASIC_013',
      field_name: 'CCP LEI',
      description: 'LEI of CCP',
      data_type: 'string',
      requirement: 'conditional',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      condition: 'Required if cleared',
      cdm_path: 'parties[role=CCP].lei',
      xml_element: 'CCPId',
      validation_rules: ['LEI_FORMAT']
    }
  ],
  validation_rules: [
    {
      rule_id: 'ASIC_VR001',
      name: 'LEI Format',
      description: 'LEI must be 20 characters',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{20}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['ASIC_001', 'ASIC_002', 'ASIC_013']
    },
    {
      rule_id: 'ASIC_VR002',
      name: 'UPI Required',
      description: 'UPI is mandatory',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'UPI is not empty',
      error_message: 'UPI is required',
      affected_fields: ['ASIC_004']
    },
    {
      rule_id: 'ASIC_VR003',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['ASIC_001', 'ASIC_002', 'ASIC_013']
    },
    {
      rule_id: 'ASIC_VR004',
      name: 'UTI Format Validation',
      description: 'UTI must be valid format per ISO 23897',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UTI matches ^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      error_message: 'Invalid UTI format',
      affected_fields: ['ASIC_003']
    },
    {
      rule_id: 'ASIC_VR005',
      name: 'UPI Format Validation',
      description: 'UPI must be valid 12-character format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UPI matches ^[A-Z0-9]{12}$',
      error_message: 'Invalid UPI format',
      affected_fields: ['ASIC_004']
    },
    {
      rule_id: 'ASIC_VR006',
      name: 'CCP for Cleared',
      description: 'CCP LEI required for cleared transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Cleared = true THEN CCP_LEI is not empty',
      error_message: 'CCP LEI required when cleared',
      affected_fields: ['ASIC_012', 'ASIC_013']
    },
    {
      rule_id: 'ASIC_VR007',
      name: 'ISO Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN iso_4217_codes',
      error_message: 'Invalid ISO 4217 currency code',
      affected_fields: ['ASIC_009', 'ASIC_014']
    },
    {
      rule_id: 'ASIC_VR008',
      name: 'Execution Date Not Future',
      description: 'Execution timestamp cannot be in the future (AEST)',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Execution_Timestamp <= current_datetime_aest',
      error_message: 'Execution timestamp cannot be in the future',
      affected_fields: ['ASIC_006']
    },
    {
      rule_id: 'ASIC_VR009',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Effective_Date',
      error_message: 'Maturity date must be after effective date',
      affected_fields: ['ASIC_007', 'ASIC_008']
    },
    {
      rule_id: 'ASIC_VR010',
      name: 'Notional Amount Positive',
      description: 'Notional amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be positive',
      affected_fields: ['ASIC_010']
    },
    {
      rule_id: 'ASIC_VR011',
      name: 'Action Type Valid',
      description: 'Action type must be valid ASIC enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Action_Type IN [NEWT, MODI, CORR, TERM, EROR, REVI, POSC, VALU]',
      error_message: 'Invalid action type for ASIC reporting',
      affected_fields: ['ASIC_005']
    },
    {
      rule_id: 'ASIC_VR012',
      name: 'Counterparty LEIs Different',
      description: 'Reporting and counterparty LEIs must be different',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Reporting_LEI != Counterparty_LEI',
      error_message: 'Reporting and counterparty LEIs must be different',
      affected_fields: ['ASIC_001', 'ASIC_002']
    },
    {
      rule_id: 'ASIC_VR013',
      name: 'T+1 Reporting Deadline',
      description: 'Transactions must be reported within T+1 per ASIC rules',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Reporting_Timestamp <= Execution_Timestamp + 1 business day AEST',
      error_message: 'Transaction should be reported within T+1',
      affected_fields: ['ASIC_006']
    },
    {
      rule_id: 'ASIC_VR014',
      name: 'Australian Nexus Required',
      description: 'At least one party must have Australian nexus',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'Reporting_Country = AU OR Counterparty_Country = AU',
      error_message: 'ASIC reporting may not apply without Australian nexus',
      affected_fields: ['ASIC_001', 'ASIC_002']
    },
    {
      rule_id: 'ASIC_VR015',
      name: 'ISIN Format Validation',
      description: 'ISIN must be valid format per ISO 6166',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'ISIN matches ^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      error_message: 'Invalid ISIN format',
      affected_fields: ['ASIC_015']
    },
    {
      rule_id: 'ASIC_VR016',
      name: 'Valuation Amount Required',
      description: 'Valuation must be provided for open positions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Position_Open = true THEN Valuation_Amount is not empty',
      error_message: 'Valuation required for open positions',
      affected_fields: ['ASIC_016']
    },
    {
      rule_id: 'ASIC_VR017',
      name: 'Counterparty Classification',
      description: 'Counterparty must be classified per ASIC rules',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Classification IN [AFSL, EXEMPT, OTHER]',
      error_message: 'Invalid counterparty classification',
      affected_fields: ['ASIC_017']
    },
    {
      rule_id: 'ASIC_VR018',
      name: 'Product Classification Valid',
      description: 'Product classification must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Product_Class IN [IR, CR, EQ, FX, CO]',
      error_message: 'Invalid product classification',
      affected_fields: ['ASIC_018']
    },
    {
      rule_id: 'ASIC_VR019',
      name: 'Day Count Convention Valid',
      description: 'Day count convention must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Day_Count IN [A360, A365, A365F, 30360, 30E360, ACT/ACT]',
      error_message: 'Invalid day count convention',
      affected_fields: ['ASIC_019']
    },
    {
      rule_id: 'ASIC_VR020',
      name: 'Payment Frequency Valid',
      description: 'Payment frequency must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Payment_Frequency IN [DAIL, WEEK, MNTH, QURT, SEMI, YEAR, TERM]',
      error_message: 'Invalid payment frequency',
      affected_fields: ['ASIC_020']
    },
    {
      rule_id: 'ASIC_VR021',
      name: 'Floating Rate Index Required',
      description: 'Floating rate index required for floating rate legs',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Rate_Type = FLOAT THEN Floating_Rate_Index is not empty',
      error_message: 'Floating rate index required for floating rate leg',
      affected_fields: ['ASIC_021']
    },
    {
      rule_id: 'ASIC_VR022',
      name: 'BBSW Reference for AUD',
      description: 'AUD floating rates should reference BBSW or AONIA',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Currency = AUD AND Rate_Type = FLOAT THEN Index LIKE BBSW OR AONIA',
      error_message: 'AUD floating rate should reference BBSW or AONIA',
      affected_fields: ['ASIC_021']
    },
    {
      rule_id: 'ASIC_VR023',
      name: 'Spread Reasonable',
      description: 'Spread must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Spread >= -500 AND Spread <= 1000 basis points',
      error_message: 'Spread outside reasonable bounds',
      affected_fields: ['ASIC_022']
    },
    {
      rule_id: 'ASIC_VR024',
      name: 'Fixed Rate Reasonable',
      description: 'Fixed rate must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Fixed_Rate >= -5 AND Fixed_Rate <= 25',
      error_message: 'Fixed rate outside reasonable bounds',
      affected_fields: ['ASIC_023']
    },
    {
      rule_id: 'ASIC_VR025',
      name: 'Compression Indicator',
      description: 'Original UTI required for compression trades',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = COMP THEN Original_UTI is not empty',
      error_message: 'Original UTI required for compression trades',
      affected_fields: ['ASIC_005', 'ASIC_024']
    },
    {
      rule_id: 'ASIC_VR026',
      name: 'Novation LEIs Required',
      description: 'Transferor and transferee LEIs required for novations',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Event_Type = NOVA THEN Transferor_LEI AND Transferee_LEI are not empty',
      error_message: 'Transferor and transferee LEIs required for novations',
      affected_fields: ['ASIC_025', 'ASIC_026']
    },
    {
      rule_id: 'ASIC_VR027',
      name: 'Unique UTI Within Entity',
      description: 'UTI must be unique within reporting entity scope',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'UTI is unique per Reporting_Entity',
      error_message: 'Duplicate UTI detected for reporting entity',
      affected_fields: ['ASIC_003']
    },
    {
      rule_id: 'ASIC_VR028',
      name: 'Settlement Type Valid',
      description: 'Settlement type must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Settlement_Type IN [PHYS, CASH]',
      error_message: 'Invalid settlement type',
      affected_fields: ['ASIC_027']
    },
    {
      rule_id: 'ASIC_VR029',
      name: 'Collateral Required for Non-Cleared',
      description: 'Collateral info required for non-centrally cleared',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Cleared = false THEN Collateralized is not empty',
      error_message: 'Collateral status required for non-cleared trades',
      affected_fields: ['ASIC_012', 'ASIC_028']
    },
    {
      rule_id: 'ASIC_VR030',
      name: 'Trade Repository LEI',
      description: 'Trade repository must be ASIC-registered',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'TR_LEI IN asic_registered_trs',
      error_message: 'Trade repository must be ASIC-registered',
      affected_fields: ['ASIC_029']
    }
  ]
};

// =============================================================================
// MAS Package (Singapore)
// =============================================================================
export const MAS_PACKAGE: RegulationPackage = {
  package_id: 'mas-2024',
  regulation_code: 'MAS',
  regulation_name: 'MAS OTC Derivatives Reporting',
  version: 'Rewrite 1.0',
  effective_date: '2024-10-21',
  description: 'Singapore OTC derivatives reporting requirements. Includes Trade, Position, and Valuation reports.',
  jurisdiction: 'SG',
  reporting_authority: 'MAS',
  field_count: 105,
  mandatory_fields: 72,
  conditional_fields: 25,
  optional_fields: 8,
  validation_rule_count: 28,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:mas:derivatives:reporting',
  output_root_element: 'DerivativesReport',
  tags: ['derivatives', 'OTC', 'MAS', 'Singapore', 'APAC'],
  report_types: [
    {
      code: 'TRADE',
      name: 'Trade Report',
      description: 'New trades and lifecycle events',
      action_types: ['NEWT', 'MODI', 'CORR', 'TERM'],
      field_count: 80
    },
    {
      code: 'POSITION',
      name: 'Position Report',
      description: 'Daily position data',
      action_types: ['POSC'],
      field_count: 50
    },
    {
      code: 'VALUATION',
      name: 'Valuation Report',
      description: 'Daily valuations',
      action_types: ['VALU'],
      field_count: 25
    }
  ],
  fields: [
    {
      field_id: 'MAS_001',
      field_name: 'Reporting Entity LEI',
      description: 'LEI of the reporting entity',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgNttyLEI',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM']
    },
    {
      field_id: 'MAS_002',
      field_name: 'Counterparty LEI',
      description: 'LEI of the counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'CtrPtyLEI',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'MAS_003',
      field_name: 'UTI',
      description: 'Unique Transaction Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      cdm_path: 'trade_event.uti',
      xml_element: 'UTI',
      validation_rules: ['UTI_FORMAT']
    },
    {
      field_id: 'MAS_004',
      field_name: 'UPI',
      description: 'Unique Product Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      cdm_path: 'product.upi',
      xml_element: 'UPI',
      validation_rules: ['UPI_FORMAT']
    },
    {
      field_id: 'MAS_005',
      field_name: 'Action Type',
      description: 'Action type',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR', 'REVI', 'VALU'],
      cdm_path: 'trade_event.action_type',
      xml_element: 'ActnTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MAS_006',
      field_name: 'Execution Timestamp',
      description: 'Timestamp of execution',
      data_type: 'datetime',
      requirement: 'mandatory',
      cdm_path: 'execution.execution_timestamp',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['ISO_DATETIME']
    },
    {
      field_id: 'MAS_007',
      field_name: 'Effective Date',
      description: 'Effective date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'MAS_008',
      field_name: 'Maturity Date',
      description: 'Maturity date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'MAS_009',
      field_name: 'Notional Amount',
      description: 'Notional amount',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.notional_amount',
      xml_element: 'NtnlAmt',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'MAS_010',
      field_name: 'Notional Currency',
      description: 'Currency of notional',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy',
      validation_rules: ['ISO_CURRENCY']
    },
    {
      field_id: 'MAS_011',
      field_name: 'Asset Class',
      description: 'Asset class',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['IR', 'CR', 'FX', 'CO', 'EQ'],
      cdm_path: 'product.asset_class',
      xml_element: 'AsstClss',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'MAS_012',
      field_name: 'Cleared',
      description: 'Clearing status',
      data_type: 'boolean',
      requirement: 'mandatory',
      cdm_path: 'trade_event.cleared',
      xml_element: 'Clrd',
      validation_rules: []
    }
  ],
  validation_rules: [
    {
      rule_id: 'MAS_VR001',
      name: 'LEI Format',
      description: 'LEI must be 20 characters',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{20}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['MAS_001', 'MAS_002']
    },
    {
      rule_id: 'MAS_VR002',
      name: 'UPI Required',
      description: 'UPI is mandatory',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'UPI is not empty',
      error_message: 'UPI is required',
      affected_fields: ['MAS_004']
    },
    {
      rule_id: 'MAS_VR003',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['MAS_001', 'MAS_002']
    },
    {
      rule_id: 'MAS_VR004',
      name: 'UTI Format Validation',
      description: 'UTI must be valid format per ISO 23897',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UTI matches ^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      error_message: 'Invalid UTI format',
      affected_fields: ['MAS_003']
    },
    {
      rule_id: 'MAS_VR005',
      name: 'UPI Format Validation',
      description: 'UPI must be valid 12-character format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UPI matches ^[A-Z0-9]{12}$',
      error_message: 'Invalid UPI format',
      affected_fields: ['MAS_004']
    },
    {
      rule_id: 'MAS_VR006',
      name: 'CCP for Cleared',
      description: 'CCP LEI required for cleared transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Cleared = true THEN CCP_LEI is not empty',
      error_message: 'CCP LEI required when cleared',
      affected_fields: ['MAS_012', 'MAS_013']
    },
    {
      rule_id: 'MAS_VR007',
      name: 'ISO Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN iso_4217_codes',
      error_message: 'Invalid ISO 4217 currency code',
      affected_fields: ['MAS_009', 'MAS_014']
    },
    {
      rule_id: 'MAS_VR008',
      name: 'Execution Date Not Future',
      description: 'Execution timestamp cannot be in the future (SGT)',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Execution_Timestamp <= current_datetime_sgt',
      error_message: 'Execution timestamp cannot be in the future',
      affected_fields: ['MAS_006']
    },
    {
      rule_id: 'MAS_VR009',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Effective_Date',
      error_message: 'Maturity date must be after effective date',
      affected_fields: ['MAS_007', 'MAS_008']
    },
    {
      rule_id: 'MAS_VR010',
      name: 'Notional Amount Positive',
      description: 'Notional amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be positive',
      affected_fields: ['MAS_010']
    },
    {
      rule_id: 'MAS_VR011',
      name: 'Action Type Valid',
      description: 'Action type must be valid MAS enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Action_Type IN [NEWT, MODI, CORR, TERM, EROR, REVI, POSC, VALU]',
      error_message: 'Invalid action type for MAS reporting',
      affected_fields: ['MAS_005']
    },
    {
      rule_id: 'MAS_VR012',
      name: 'Counterparty LEIs Different',
      description: 'Reporting and counterparty LEIs must be different',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Reporting_LEI != Counterparty_LEI',
      error_message: 'Reporting and counterparty LEIs must be different',
      affected_fields: ['MAS_001', 'MAS_002']
    },
    {
      rule_id: 'MAS_VR013',
      name: 'T+2 Reporting Deadline',
      description: 'Transactions must be reported within T+2 per MAS rules',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Reporting_Timestamp <= Execution_Timestamp + 2 business days SGT',
      error_message: 'Transaction should be reported within T+2',
      affected_fields: ['MAS_006']
    },
    {
      rule_id: 'MAS_VR014',
      name: 'Singapore Nexus Required',
      description: 'At least one party must have Singapore nexus',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'Reporting_Country = SG OR Counterparty_Country = SG',
      error_message: 'MAS reporting may not apply without Singapore nexus',
      affected_fields: ['MAS_001', 'MAS_002']
    },
    {
      rule_id: 'MAS_VR015',
      name: 'ISIN Format Validation',
      description: 'ISIN must be valid format per ISO 6166',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'ISIN matches ^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      error_message: 'Invalid ISIN format',
      affected_fields: ['MAS_015']
    },
    {
      rule_id: 'MAS_VR016',
      name: 'Counterparty Classification',
      description: 'Counterparty must be classified per MAS rules',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Classification IN [FI, NFI, EXEMPT]',
      error_message: 'Invalid counterparty classification',
      affected_fields: ['MAS_016']
    },
    {
      rule_id: 'MAS_VR017',
      name: 'Product Classification Valid',
      description: 'Product classification must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Product_Class IN [IR, CR, EQ, FX, CO]',
      error_message: 'Invalid product classification',
      affected_fields: ['MAS_017']
    },
    {
      rule_id: 'MAS_VR018',
      name: 'Day Count Convention Valid',
      description: 'Day count convention must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Day_Count IN [A360, A365, A365F, 30360, 30E360, ACT/ACT]',
      error_message: 'Invalid day count convention',
      affected_fields: ['MAS_018']
    },
    {
      rule_id: 'MAS_VR019',
      name: 'Payment Frequency Valid',
      description: 'Payment frequency must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Payment_Frequency IN [DAIL, WEEK, MNTH, QURT, SEMI, YEAR, TERM]',
      error_message: 'Invalid payment frequency',
      affected_fields: ['MAS_019']
    },
    {
      rule_id: 'MAS_VR020',
      name: 'Floating Rate Index Required',
      description: 'Floating rate index required for floating rate legs',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Rate_Type = FLOAT THEN Floating_Rate_Index is not empty',
      error_message: 'Floating rate index required for floating rate leg',
      affected_fields: ['MAS_020']
    },
    {
      rule_id: 'MAS_VR021',
      name: 'SORA Reference for SGD',
      description: 'SGD floating rates should reference SORA',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Currency = SGD AND Rate_Type = FLOAT THEN Index LIKE SORA',
      error_message: 'SGD floating rate should reference SORA',
      affected_fields: ['MAS_020']
    },
    {
      rule_id: 'MAS_VR022',
      name: 'Spread Reasonable',
      description: 'Spread must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Spread >= -500 AND Spread <= 1000 basis points',
      error_message: 'Spread outside reasonable bounds',
      affected_fields: ['MAS_021']
    },
    {
      rule_id: 'MAS_VR023',
      name: 'Fixed Rate Reasonable',
      description: 'Fixed rate must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Fixed_Rate >= -5 AND Fixed_Rate <= 25',
      error_message: 'Fixed rate outside reasonable bounds',
      affected_fields: ['MAS_022']
    },
    {
      rule_id: 'MAS_VR024',
      name: 'Compression Indicator',
      description: 'Original UTI required for compression trades',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = COMP THEN Original_UTI is not empty',
      error_message: 'Original UTI required for compression trades',
      affected_fields: ['MAS_005', 'MAS_023']
    },
    {
      rule_id: 'MAS_VR025',
      name: 'Novation LEIs Required',
      description: 'Transferor and transferee LEIs required for novations',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Event_Type = NOVA THEN Transferor_LEI AND Transferee_LEI are not empty',
      error_message: 'Transferor and transferee LEIs required for novations',
      affected_fields: ['MAS_024', 'MAS_025']
    },
    {
      rule_id: 'MAS_VR026',
      name: 'Unique UTI Within Entity',
      description: 'UTI must be unique within reporting entity scope',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'UTI is unique per Reporting_Entity',
      error_message: 'Duplicate UTI detected for reporting entity',
      affected_fields: ['MAS_003']
    },
    {
      rule_id: 'MAS_VR027',
      name: 'Settlement Type Valid',
      description: 'Settlement type must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Settlement_Type IN [PHYS, CASH]',
      error_message: 'Invalid settlement type',
      affected_fields: ['MAS_026']
    },
    {
      rule_id: 'MAS_VR028',
      name: 'Trade Repository Registered',
      description: 'Trade repository must be MAS-registered',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'TR_LEI IN mas_registered_trs',
      error_message: 'Trade repository must be MAS-registered',
      affected_fields: ['MAS_027']
    }
  ]
};

// =============================================================================
// HKMA Package (Hong Kong) - Coming September 2025
// =============================================================================
export const HKMA_PACKAGE: RegulationPackage = {
  package_id: 'hkma-2025',
  regulation_code: 'HKMA',
  regulation_name: 'HKMA OTC Derivatives Reporting',
  version: '1.0',
  effective_date: '2025-09-29',
  description: 'Hong Kong OTC derivatives reporting. Includes Trade, Position, and Valuation reports.',
  jurisdiction: 'HK',
  reporting_authority: 'HKMA',
  field_count: 100,
  mandatory_fields: 68,
  conditional_fields: 24,
  optional_fields: 8,
  validation_rule_count: 25,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:hkma:derivatives:reporting',
  output_root_element: 'DerivativesReport',
  tags: ['derivatives', 'OTC', 'HKMA', 'Hong Kong', 'APAC', 'upcoming'],
  report_types: [
    {
      code: 'TRADE',
      name: 'Trade Report',
      description: 'New trades and lifecycle events',
      action_types: ['NEWT', 'MODI', 'CORR', 'TERM'],
      field_count: 75
    },
    {
      code: 'POSITION',
      name: 'Position Report',
      description: 'Daily position data',
      action_types: ['POSC'],
      field_count: 48
    },
    {
      code: 'VALUATION',
      name: 'Valuation Report',
      description: 'Daily valuations',
      action_types: ['VALU'],
      field_count: 22
    }
  ],
  fields: [
    {
      field_id: 'HKMA_001',
      field_name: 'Reporting Entity LEI',
      description: 'LEI of the reporting entity',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgNttyLEI',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM']
    },
    {
      field_id: 'HKMA_002',
      field_name: 'Counterparty LEI',
      description: 'LEI of the counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'CtrPtyLEI',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'HKMA_003',
      field_name: 'UTI',
      description: 'Unique Transaction Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      cdm_path: 'trade_event.uti',
      xml_element: 'UTI',
      validation_rules: ['UTI_FORMAT']
    },
    {
      field_id: 'HKMA_004',
      field_name: 'UPI',
      description: 'Unique Product Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      cdm_path: 'product.upi',
      xml_element: 'UPI',
      validation_rules: ['UPI_FORMAT']
    },
    {
      field_id: 'HKMA_005',
      field_name: 'Action Type',
      description: 'Action type',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR', 'REVI', 'VALU'],
      cdm_path: 'trade_event.action_type',
      xml_element: 'ActnTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'HKMA_006',
      field_name: 'Execution Timestamp',
      description: 'Timestamp of execution',
      data_type: 'datetime',
      requirement: 'mandatory',
      cdm_path: 'execution.execution_timestamp',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['ISO_DATETIME']
    },
    {
      field_id: 'HKMA_007',
      field_name: 'Effective Date',
      description: 'Effective date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'HKMA_008',
      field_name: 'Maturity Date',
      description: 'Maturity date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'HKMA_009',
      field_name: 'Notional Amount',
      description: 'Notional amount',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.notional_amount',
      xml_element: 'NtnlAmt',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'HKMA_010',
      field_name: 'Notional Currency',
      description: 'Currency of notional',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy',
      validation_rules: ['ISO_CURRENCY']
    }
  ],
  validation_rules: [
    {
      rule_id: 'HKMA_VR001',
      name: 'LEI Format',
      description: 'LEI must be 20 characters',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{20}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['HKMA_001', 'HKMA_002']
    },
    {
      rule_id: 'HKMA_VR002',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['HKMA_001', 'HKMA_002']
    },
    {
      rule_id: 'HKMA_VR003',
      name: 'UTI Format Validation',
      description: 'UTI must be valid format per ISO 23897',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UTI matches ^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      error_message: 'Invalid UTI format',
      affected_fields: ['HKMA_003']
    },
    {
      rule_id: 'HKMA_VR004',
      name: 'UPI Format Validation',
      description: 'UPI must be valid 12-character format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UPI matches ^[A-Z0-9]{12}$',
      error_message: 'Invalid UPI format',
      affected_fields: ['HKMA_004']
    },
    {
      rule_id: 'HKMA_VR005',
      name: 'UPI Required',
      description: 'UPI is mandatory',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'UPI is not empty',
      error_message: 'UPI is required',
      affected_fields: ['HKMA_004']
    },
    {
      rule_id: 'HKMA_VR006',
      name: 'CCP for Cleared',
      description: 'CCP LEI required for cleared transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Cleared = true THEN CCP_LEI is not empty',
      error_message: 'CCP LEI required when cleared',
      affected_fields: ['HKMA_012', 'HKMA_013']
    },
    {
      rule_id: 'HKMA_VR007',
      name: 'ISO Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN iso_4217_codes',
      error_message: 'Invalid ISO 4217 currency code',
      affected_fields: ['HKMA_009', 'HKMA_014']
    },
    {
      rule_id: 'HKMA_VR008',
      name: 'Execution Date Not Future',
      description: 'Execution timestamp cannot be in the future (HKT)',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Execution_Timestamp <= current_datetime_hkt',
      error_message: 'Execution timestamp cannot be in the future',
      affected_fields: ['HKMA_006']
    },
    {
      rule_id: 'HKMA_VR009',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Effective_Date',
      error_message: 'Maturity date must be after effective date',
      affected_fields: ['HKMA_007', 'HKMA_008']
    },
    {
      rule_id: 'HKMA_VR010',
      name: 'Notional Amount Positive',
      description: 'Notional amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be positive',
      affected_fields: ['HKMA_010']
    },
    {
      rule_id: 'HKMA_VR011',
      name: 'Action Type Valid',
      description: 'Action type must be valid HKMA enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Action_Type IN [NEWT, MODI, CORR, TERM, EROR, REVI, POSC, VALU]',
      error_message: 'Invalid action type for HKMA reporting',
      affected_fields: ['HKMA_005']
    },
    {
      rule_id: 'HKMA_VR012',
      name: 'Counterparty LEIs Different',
      description: 'Reporting and counterparty LEIs must be different',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Reporting_LEI != Counterparty_LEI',
      error_message: 'Reporting and counterparty LEIs must be different',
      affected_fields: ['HKMA_001', 'HKMA_002']
    },
    {
      rule_id: 'HKMA_VR013',
      name: 'T+2 Reporting Deadline',
      description: 'Transactions must be reported within T+2 per HKMA rules',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Reporting_Timestamp <= Execution_Timestamp + 2 business days HKT',
      error_message: 'Transaction should be reported within T+2',
      affected_fields: ['HKMA_006']
    },
    {
      rule_id: 'HKMA_VR014',
      name: 'Hong Kong Nexus Required',
      description: 'At least one party must have Hong Kong nexus',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'Reporting_Country = HK OR Counterparty_Country = HK',
      error_message: 'HKMA reporting may not apply without Hong Kong nexus',
      affected_fields: ['HKMA_001', 'HKMA_002']
    },
    {
      rule_id: 'HKMA_VR015',
      name: 'ISIN Format Validation',
      description: 'ISIN must be valid format per ISO 6166',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'ISIN matches ^[A-Z]{2}[A-Z0-9]{9}[0-9]$',
      error_message: 'Invalid ISIN format',
      affected_fields: ['HKMA_015']
    },
    {
      rule_id: 'HKMA_VR016',
      name: 'Counterparty Classification',
      description: 'Counterparty must be classified per HKMA rules',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Classification IN [AI, PI, OTHER]',
      error_message: 'Invalid counterparty classification',
      affected_fields: ['HKMA_016']
    },
    {
      rule_id: 'HKMA_VR017',
      name: 'Product Classification Valid',
      description: 'Product classification must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Product_Class IN [IR, CR, EQ, FX, CO]',
      error_message: 'Invalid product classification',
      affected_fields: ['HKMA_017']
    },
    {
      rule_id: 'HKMA_VR018',
      name: 'Day Count Convention Valid',
      description: 'Day count convention must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Day_Count IN [A360, A365, A365F, 30360, 30E360, ACT/ACT]',
      error_message: 'Invalid day count convention',
      affected_fields: ['HKMA_018']
    },
    {
      rule_id: 'HKMA_VR019',
      name: 'Floating Rate Index Required',
      description: 'Floating rate index required for floating rate legs',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Rate_Type = FLOAT THEN Floating_Rate_Index is not empty',
      error_message: 'Floating rate index required for floating rate leg',
      affected_fields: ['HKMA_019']
    },
    {
      rule_id: 'HKMA_VR020',
      name: 'HIBOR Reference for HKD',
      description: 'HKD floating rates should reference HIBOR or HONIA',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Currency = HKD AND Rate_Type = FLOAT THEN Index LIKE HIBOR OR HONIA',
      error_message: 'HKD floating rate should reference HIBOR or HONIA',
      affected_fields: ['HKMA_019']
    },
    {
      rule_id: 'HKMA_VR021',
      name: 'Spread Reasonable',
      description: 'Spread must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Spread >= -500 AND Spread <= 1000 basis points',
      error_message: 'Spread outside reasonable bounds',
      affected_fields: ['HKMA_020']
    },
    {
      rule_id: 'HKMA_VR022',
      name: 'Compression Indicator',
      description: 'Original UTI required for compression trades',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = COMP THEN Original_UTI is not empty',
      error_message: 'Original UTI required for compression trades',
      affected_fields: ['HKMA_005', 'HKMA_021']
    },
    {
      rule_id: 'HKMA_VR023',
      name: 'Novation LEIs Required',
      description: 'Transferor and transferee LEIs required for novations',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Event_Type = NOVA THEN Transferor_LEI AND Transferee_LEI are not empty',
      error_message: 'Transferor and transferee LEIs required for novations',
      affected_fields: ['HKMA_022', 'HKMA_023']
    },
    {
      rule_id: 'HKMA_VR024',
      name: 'Unique UTI Within Entity',
      description: 'UTI must be unique within reporting entity scope',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'UTI is unique per Reporting_Entity',
      error_message: 'Duplicate UTI detected for reporting entity',
      affected_fields: ['HKMA_003']
    },
    {
      rule_id: 'HKMA_VR025',
      name: 'Trade Repository Registered',
      description: 'Trade repository must be HKMA-registered',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'TR_LEI IN hkma_registered_trs',
      error_message: 'Trade repository must be HKMA-registered',
      affected_fields: ['HKMA_024']
    }
  ]
};

// =============================================================================
// Canadian Package - Coming July 2025
// =============================================================================
export const CANADA_PACKAGE: RegulationPackage = {
  package_id: 'canada-2025',
  regulation_code: 'OSC_AMF',
  regulation_name: 'Canadian Securities Administrators Derivatives Reporting',
  version: '1.0',
  effective_date: '2025-07-25',
  description: 'Canadian OTC derivatives reporting. Includes Trade, Position, and Valuation reports.',
  jurisdiction: 'CA',
  reporting_authority: 'CSA',
  field_count: 95,
  mandatory_fields: 62,
  conditional_fields: 25,
  optional_fields: 8,
  validation_rule_count: 25,
  output_format: 'DTCC Harmonized XML',
  output_namespace: 'urn:csa:derivatives:reporting',
  output_root_element: 'DerivativesReport',
  tags: ['derivatives', 'OTC', 'OSC', 'AMF', 'Canada', 'upcoming'],
  report_types: [
    {
      code: 'TRADE',
      name: 'Trade Report',
      description: 'New trades and lifecycle events',
      action_types: ['NEWT', 'MODI', 'CORR', 'TERM'],
      field_count: 72
    },
    {
      code: 'POSITION',
      name: 'Position Report',
      description: 'Daily position data',
      action_types: ['POSC'],
      field_count: 45
    },
    {
      code: 'VALUATION',
      name: 'Valuation Report',
      description: 'Daily valuations',
      action_types: ['VALU'],
      field_count: 22
    }
  ],
  fields: [
    {
      field_id: 'CA_001',
      field_name: 'Reporting Party LEI',
      description: 'LEI of the reporting party',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgPrtyLEI',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM']
    },
    {
      field_id: 'CA_002',
      field_name: 'Counterparty LEI',
      description: 'LEI of the counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'CtrPtyLEI',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'CA_003',
      field_name: 'UTI',
      description: 'Unique Transaction Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      cdm_path: 'trade_event.uti',
      xml_element: 'UTI',
      validation_rules: ['UTI_FORMAT']
    },
    {
      field_id: 'CA_004',
      field_name: 'UPI',
      description: 'Unique Product Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      cdm_path: 'product.upi',
      xml_element: 'UPI',
      validation_rules: ['UPI_FORMAT']
    },
    {
      field_id: 'CA_005',
      field_name: 'Action Type',
      description: 'Action type',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR'],
      cdm_path: 'trade_event.action_type',
      xml_element: 'ActnTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'CA_006',
      field_name: 'Execution Timestamp',
      description: 'Timestamp of execution',
      data_type: 'datetime',
      requirement: 'mandatory',
      cdm_path: 'execution.execution_timestamp',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['ISO_DATETIME']
    },
    {
      field_id: 'CA_007',
      field_name: 'Effective Date',
      description: 'Effective date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'CA_008',
      field_name: 'Maturity Date',
      description: 'Maturity date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'CA_009',
      field_name: 'Notional Amount',
      description: 'Notional amount',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.notional_amount',
      xml_element: 'NtnlAmt',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'CA_010',
      field_name: 'Notional Currency',
      description: 'Currency of notional',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy',
      validation_rules: ['ISO_CURRENCY']
    }
  ],
  validation_rules: [
    {
      rule_id: 'CA_VR001',
      name: 'LEI Format',
      description: 'LEI must be 20 characters',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{20}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['CA_001', 'CA_002']
    },
    {
      rule_id: 'CA_VR002',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['CA_001', 'CA_002']
    },
    {
      rule_id: 'CA_VR003',
      name: 'UTI Format Validation',
      description: 'UTI must be valid format per ISO 23897',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UTI matches ^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      error_message: 'Invalid UTI format',
      affected_fields: ['CA_003']
    },
    {
      rule_id: 'CA_VR004',
      name: 'UPI Format Validation',
      description: 'UPI must be valid 12-character format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UPI matches ^[A-Z0-9]{12}$',
      error_message: 'Invalid UPI format',
      affected_fields: ['CA_004']
    },
    {
      rule_id: 'CA_VR005',
      name: 'UPI Required',
      description: 'UPI is mandatory',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'UPI is not empty',
      error_message: 'UPI is required',
      affected_fields: ['CA_004']
    },
    {
      rule_id: 'CA_VR006',
      name: 'CCP for Cleared',
      description: 'CCP LEI required for cleared transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Cleared = true THEN CCP_LEI is not empty',
      error_message: 'CCP LEI required when cleared',
      affected_fields: ['CA_011', 'CA_012']
    },
    {
      rule_id: 'CA_VR007',
      name: 'ISO Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN iso_4217_codes',
      error_message: 'Invalid ISO 4217 currency code',
      affected_fields: ['CA_010']
    },
    {
      rule_id: 'CA_VR008',
      name: 'Execution Date Not Future',
      description: 'Execution timestamp cannot be in the future',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Execution_Timestamp <= current_datetime',
      error_message: 'Execution timestamp cannot be in the future',
      affected_fields: ['CA_006']
    },
    {
      rule_id: 'CA_VR009',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Effective_Date',
      error_message: 'Maturity date must be after effective date',
      affected_fields: ['CA_007', 'CA_008']
    },
    {
      rule_id: 'CA_VR010',
      name: 'Notional Amount Positive',
      description: 'Notional amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be positive',
      affected_fields: ['CA_009']
    },
    {
      rule_id: 'CA_VR011',
      name: 'Action Type Valid',
      description: 'Action type must be valid CSA enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Action_Type IN [NEWT, MODI, CORR, TERM, EROR, REVI, POSC, VALU]',
      error_message: 'Invalid action type for CSA reporting',
      affected_fields: ['CA_005']
    },
    {
      rule_id: 'CA_VR012',
      name: 'Counterparty LEIs Different',
      description: 'Reporting and counterparty LEIs must be different',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Reporting_LEI != Counterparty_LEI',
      error_message: 'Reporting and counterparty LEIs must be different',
      affected_fields: ['CA_001', 'CA_002']
    },
    {
      rule_id: 'CA_VR013',
      name: 'T+1 Reporting Deadline',
      description: 'Transactions must be reported within T+1 per CSA rules',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Reporting_Timestamp <= Execution_Timestamp + 1 business day',
      error_message: 'Transaction should be reported within T+1',
      affected_fields: ['CA_006']
    },
    {
      rule_id: 'CA_VR014',
      name: 'Canadian Nexus Required',
      description: 'At least one party must have Canadian nexus',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'Reporting_Country = CA OR Counterparty_Country = CA',
      error_message: 'CSA reporting may not apply without Canadian nexus',
      affected_fields: ['CA_001', 'CA_002']
    },
    {
      rule_id: 'CA_VR015',
      name: 'Product Classification Valid',
      description: 'Product classification must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Product_Class IN [IR, CR, EQ, FX, CO]',
      error_message: 'Invalid product classification',
      affected_fields: ['CA_013']
    },
    {
      rule_id: 'CA_VR016',
      name: 'Day Count Convention Valid',
      description: 'Day count convention must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Day_Count IN [A360, A365, A365F, 30360, 30E360, ACT/ACT]',
      error_message: 'Invalid day count convention',
      affected_fields: ['CA_014']
    },
    {
      rule_id: 'CA_VR017',
      name: 'Payment Frequency Valid',
      description: 'Payment frequency must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Payment_Frequency IN [DAIL, WEEK, MNTH, QURT, SEMI, YEAR, TERM]',
      error_message: 'Invalid payment frequency',
      affected_fields: ['CA_015']
    },
    {
      rule_id: 'CA_VR018',
      name: 'Floating Rate Index Required',
      description: 'Floating rate index required for floating rate legs',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Rate_Type = FLOAT THEN Floating_Rate_Index is not empty',
      error_message: 'Floating rate index required for floating rate leg',
      affected_fields: ['CA_016']
    },
    {
      rule_id: 'CA_VR019',
      name: 'CORRA Reference for CAD',
      description: 'CAD floating rates should reference CORRA',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Currency = CAD AND Rate_Type = FLOAT THEN Index LIKE CORRA',
      error_message: 'CAD floating rate should reference CORRA',
      affected_fields: ['CA_016']
    },
    {
      rule_id: 'CA_VR020',
      name: 'Spread Reasonable',
      description: 'Spread must be within reasonable bounds',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Spread >= -500 AND Spread <= 1000 basis points',
      error_message: 'Spread outside reasonable bounds',
      affected_fields: ['CA_017']
    },
    {
      rule_id: 'CA_VR021',
      name: 'Compression Indicator',
      description: 'Original UTI required for compression trades',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = COMP THEN Original_UTI is not empty',
      error_message: 'Original UTI required for compression trades',
      affected_fields: ['CA_005', 'CA_018']
    },
    {
      rule_id: 'CA_VR022',
      name: 'Novation LEIs Required',
      description: 'Transferor and transferee LEIs required for novations',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Event_Type = NOVA THEN Transferor_LEI AND Transferee_LEI are not empty',
      error_message: 'Transferor and transferee LEIs required for novations',
      affected_fields: ['CA_019', 'CA_020']
    },
    {
      rule_id: 'CA_VR023',
      name: 'Unique UTI Within Entity',
      description: 'UTI must be unique within reporting entity scope',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'UTI is unique per Reporting_Entity',
      error_message: 'Duplicate UTI detected for reporting entity',
      affected_fields: ['CA_003']
    },
    {
      rule_id: 'CA_VR024',
      name: 'Settlement Type Valid',
      description: 'Settlement type must be valid enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Settlement_Type IN [PHYS, CASH]',
      error_message: 'Invalid settlement type',
      affected_fields: ['CA_021']
    },
    {
      rule_id: 'CA_VR025',
      name: 'Trade Repository Registered',
      description: 'Trade repository must be CSA-registered',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'TR_LEI IN csa_registered_trs',
      error_message: 'Trade repository must be CSA-registered',
      affected_fields: ['CA_022']
    }
  ]
};

// =============================================================================
// Swiss FMIA Package - Planned
// =============================================================================
export const SWISS_FMIA_PACKAGE: RegulationPackage = {
  package_id: 'swiss-fmia-2025',
  regulation_code: 'FMIA',
  regulation_name: 'Swiss Financial Market Infrastructure Act',
  version: '1.0',
  effective_date: '2025-12-01',
  description: 'Swiss OTC derivatives reporting. Includes Trade, Position, and Valuation reports.',
  jurisdiction: 'CH',
  reporting_authority: 'FINMA',
  field_count: 90,
  mandatory_fields: 60,
  conditional_fields: 22,
  optional_fields: 8,
  validation_rule_count: 22,
  output_format: 'ISO 20022 XML',
  output_namespace: 'urn:finma:fmia:reporting',
  output_root_element: 'DerivativesReport',
  tags: ['derivatives', 'OTC', 'FINMA', 'Switzerland', 'Europe', 'upcoming'],
  report_types: [
    {
      code: 'TRADE',
      name: 'Trade Report',
      description: 'New trades and lifecycle events',
      action_types: ['NEWT', 'MODI', 'CORR', 'TERM'],
      field_count: 68
    },
    {
      code: 'POSITION',
      name: 'Position Report',
      description: 'Daily position data',
      action_types: ['POSC'],
      field_count: 42
    },
    {
      code: 'VALUATION',
      name: 'Valuation Report',
      description: 'Daily valuations',
      action_types: ['VALU'],
      field_count: 20
    }
  ],
  fields: [
    {
      field_id: 'FMIA_001',
      field_name: 'Reporting Entity LEI',
      description: 'LEI of the reporting entity',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=REPORTING].lei',
      xml_element: 'RptgNttyLEI',
      validation_rules: ['LEI_FORMAT', 'LEI_CHECKSUM']
    },
    {
      field_id: 'FMIA_002',
      field_name: 'Counterparty LEI',
      description: 'LEI of the counterparty',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 20,
      pattern: '^[A-Z0-9]{20}$',
      cdm_path: 'parties[role=OTHER].lei',
      xml_element: 'CtrPtyLEI',
      validation_rules: ['LEI_FORMAT']
    },
    {
      field_id: 'FMIA_003',
      field_name: 'UTI',
      description: 'Unique Transaction Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 52,
      cdm_path: 'trade_event.uti',
      xml_element: 'UTI',
      validation_rules: ['UTI_FORMAT']
    },
    {
      field_id: 'FMIA_004',
      field_name: 'UPI',
      description: 'Unique Product Identifier',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 12,
      cdm_path: 'product.upi',
      xml_element: 'UPI',
      validation_rules: ['UPI_FORMAT']
    },
    {
      field_id: 'FMIA_005',
      field_name: 'Action Type',
      description: 'Action type',
      data_type: 'string',
      requirement: 'mandatory',
      enum_values: ['NEWT', 'MODI', 'CORR', 'TERM', 'EROR'],
      cdm_path: 'trade_event.action_type',
      xml_element: 'ActnTp',
      validation_rules: ['ENUM_VALUE']
    },
    {
      field_id: 'FMIA_006',
      field_name: 'Execution Timestamp',
      description: 'Timestamp of execution',
      data_type: 'datetime',
      requirement: 'mandatory',
      cdm_path: 'execution.execution_timestamp',
      xml_element: 'ExctnTmStmp',
      validation_rules: ['ISO_DATETIME']
    },
    {
      field_id: 'FMIA_007',
      field_name: 'Effective Date',
      description: 'Effective date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.effective_date',
      xml_element: 'FctvDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'FMIA_008',
      field_name: 'Maturity Date',
      description: 'Maturity date',
      data_type: 'date',
      requirement: 'mandatory',
      cdm_path: 'product.maturity_date',
      xml_element: 'MtrtyDt',
      validation_rules: ['ISO_DATE']
    },
    {
      field_id: 'FMIA_009',
      field_name: 'Notional Amount',
      description: 'Notional amount',
      data_type: 'decimal',
      requirement: 'mandatory',
      cdm_path: 'product.notional_amount',
      xml_element: 'NtnlAmt',
      validation_rules: ['POSITIVE_NUMBER']
    },
    {
      field_id: 'FMIA_010',
      field_name: 'Notional Currency',
      description: 'Currency of notional',
      data_type: 'string',
      requirement: 'mandatory',
      max_length: 3,
      pattern: '^[A-Z]{3}$',
      cdm_path: 'product.notional_currency',
      xml_element: 'NtnlCcy',
      validation_rules: ['ISO_CURRENCY']
    }
  ],
  validation_rules: [
    {
      rule_id: 'FMIA_VR001',
      name: 'LEI Format',
      description: 'LEI must be 20 characters',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'LEI matches ^[A-Z0-9]{20}$',
      error_message: 'Invalid LEI format',
      affected_fields: ['FMIA_001', 'FMIA_002']
    },
    {
      rule_id: 'FMIA_VR002',
      name: 'LEI Checksum Validation',
      description: 'LEI must pass MOD 97-10 checksum per ISO 17442',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'lei_checksum_valid(LEI)',
      error_message: 'LEI checksum validation failed',
      affected_fields: ['FMIA_001', 'FMIA_002']
    },
    {
      rule_id: 'FMIA_VR003',
      name: 'UTI Format Validation',
      description: 'UTI must be valid format per ISO 23897',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UTI matches ^[A-Z0-9]{20}[A-Za-z0-9]{1,32}$',
      error_message: 'Invalid UTI format',
      affected_fields: ['FMIA_003']
    },
    {
      rule_id: 'FMIA_VR004',
      name: 'UPI Format Validation',
      description: 'UPI must be valid 12-character format',
      severity: 'ERROR',
      rule_type: 'format',
      expression: 'UPI matches ^[A-Z0-9]{12}$',
      error_message: 'Invalid UPI format',
      affected_fields: ['FMIA_004']
    },
    {
      rule_id: 'FMIA_VR005',
      name: 'UPI Required',
      description: 'UPI is mandatory',
      severity: 'ERROR',
      rule_type: 'required',
      expression: 'UPI is not empty',
      error_message: 'UPI is required',
      affected_fields: ['FMIA_004']
    },
    {
      rule_id: 'FMIA_VR006',
      name: 'CCP for Cleared',
      description: 'CCP LEI required for cleared transactions',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Cleared = true THEN CCP_LEI is not empty',
      error_message: 'CCP LEI required when cleared',
      affected_fields: ['FMIA_011', 'FMIA_012']
    },
    {
      rule_id: 'FMIA_VR007',
      name: 'ISO Currency Code',
      description: 'Currency must be valid ISO 4217 code',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'Currency IN iso_4217_codes',
      error_message: 'Invalid ISO 4217 currency code',
      affected_fields: ['FMIA_010']
    },
    {
      rule_id: 'FMIA_VR008',
      name: 'Execution Date Not Future',
      description: 'Execution timestamp cannot be in the future (CET)',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Execution_Timestamp <= current_datetime_cet',
      error_message: 'Execution timestamp cannot be in the future',
      affected_fields: ['FMIA_006']
    },
    {
      rule_id: 'FMIA_VR009',
      name: 'Maturity After Effective',
      description: 'Maturity date must be after effective date',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Maturity_Date > Effective_Date',
      error_message: 'Maturity date must be after effective date',
      affected_fields: ['FMIA_007', 'FMIA_008']
    },
    {
      rule_id: 'FMIA_VR010',
      name: 'Notional Amount Positive',
      description: 'Notional amount must be positive',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'Notional_Amount > 0',
      error_message: 'Notional amount must be positive',
      affected_fields: ['FMIA_009']
    },
    {
      rule_id: 'FMIA_VR011',
      name: 'Action Type Valid',
      description: 'Action type must be valid FINMA enumeration',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Action_Type IN [NEWT, MODI, CORR, TERM, EROR, REVI, POSC, VALU]',
      error_message: 'Invalid action type for FINMA reporting',
      affected_fields: ['FMIA_005']
    },
    {
      rule_id: 'FMIA_VR012',
      name: 'Counterparty LEIs Different',
      description: 'Reporting and counterparty LEIs must be different',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'Reporting_LEI != Counterparty_LEI',
      error_message: 'Reporting and counterparty LEIs must be different',
      affected_fields: ['FMIA_001', 'FMIA_002']
    },
    {
      rule_id: 'FMIA_VR013',
      name: 'T+1 Reporting Deadline',
      description: 'Transactions must be reported within T+1 per FMIA rules',
      severity: 'WARNING',
      rule_type: 'business',
      expression: 'Reporting_Timestamp <= Execution_Timestamp + 1 business day CET',
      error_message: 'Transaction should be reported within T+1',
      affected_fields: ['FMIA_006']
    },
    {
      rule_id: 'FMIA_VR014',
      name: 'Swiss Nexus Required',
      description: 'At least one party must have Swiss nexus',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'Reporting_Country = CH OR Counterparty_Country = CH',
      error_message: 'FMIA reporting may not apply without Swiss nexus',
      affected_fields: ['FMIA_001', 'FMIA_002']
    },
    {
      rule_id: 'FMIA_VR015',
      name: 'Product Classification Valid',
      description: 'Product classification must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Product_Class IN [IR, CR, EQ, FX, CO]',
      error_message: 'Invalid product classification',
      affected_fields: ['FMIA_013']
    },
    {
      rule_id: 'FMIA_VR016',
      name: 'Day Count Convention Valid',
      description: 'Day count convention must be valid',
      severity: 'ERROR',
      rule_type: 'enum',
      expression: 'Day_Count IN [A360, A365, A365F, 30360, 30E360, ACT/ACT]',
      error_message: 'Invalid day count convention',
      affected_fields: ['FMIA_014']
    },
    {
      rule_id: 'FMIA_VR017',
      name: 'Floating Rate Index Required',
      description: 'Floating rate index required for floating rate legs',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Rate_Type = FLOAT THEN Floating_Rate_Index is not empty',
      error_message: 'Floating rate index required for floating rate leg',
      affected_fields: ['FMIA_015']
    },
    {
      rule_id: 'FMIA_VR018',
      name: 'SARON Reference for CHF',
      description: 'CHF floating rates should reference SARON',
      severity: 'WARNING',
      rule_type: 'cross_field',
      expression: 'IF Currency = CHF AND Rate_Type = FLOAT THEN Index LIKE SARON',
      error_message: 'CHF floating rate should reference SARON',
      affected_fields: ['FMIA_015']
    },
    {
      rule_id: 'FMIA_VR019',
      name: 'Compression Indicator',
      description: 'Original UTI required for compression trades',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Action_Type = COMP THEN Original_UTI is not empty',
      error_message: 'Original UTI required for compression trades',
      affected_fields: ['FMIA_005', 'FMIA_016']
    },
    {
      rule_id: 'FMIA_VR020',
      name: 'Novation LEIs Required',
      description: 'Transferor and transferee LEIs required for novations',
      severity: 'ERROR',
      rule_type: 'cross_field',
      expression: 'IF Event_Type = NOVA THEN Transferor_LEI AND Transferee_LEI are not empty',
      error_message: 'Transferor and transferee LEIs required for novations',
      affected_fields: ['FMIA_017', 'FMIA_018']
    },
    {
      rule_id: 'FMIA_VR021',
      name: 'Unique UTI Within Entity',
      description: 'UTI must be unique within reporting entity scope',
      severity: 'ERROR',
      rule_type: 'business',
      expression: 'UTI is unique per Reporting_Entity',
      error_message: 'Duplicate UTI detected for reporting entity',
      affected_fields: ['FMIA_003']
    },
    {
      rule_id: 'FMIA_VR022',
      name: 'Trade Repository Registered',
      description: 'Trade repository must be FINMA-registered',
      severity: 'ERROR',
      rule_type: 'referential',
      expression: 'TR_LEI IN finma_registered_trs',
      error_message: 'Trade repository must be FINMA-registered',
      affected_fields: ['FMIA_019']
    }
  ]
};

// =============================================================================
// Package Registry
// =============================================================================

export const ALL_PACKAGES: RegulationPackage[] = [
  // EU Regulations
  EMIR_PACKAGE,
  MIFIR_PACKAGE,
  SFTR_PACKAGE,
  // US Regulation
  CFTC_PACKAGE,
  // UK Regulations
  UK_EMIR_PACKAGE,
  // Asia-Pacific Regulations
  JFSA_PACKAGE,
  ASIC_PACKAGE,
  MAS_PACKAGE,
  HKMA_PACKAGE,
  // Americas
  CANADA_PACKAGE,
  // Europe (non-EU)
  SWISS_FMIA_PACKAGE,
];

export function getPackageById(packageId: string): RegulationPackage | undefined {
  return ALL_PACKAGES.find(
    (pkg) => pkg.package_id === packageId || pkg.regulation_code === packageId.toUpperCase()
  );
}

export function getPackageSummaries() {
  return ALL_PACKAGES.map((pkg) => ({
    package_id: pkg.package_id,
    regulation_code: pkg.regulation_code,
    regulation_name: pkg.regulation_name,
    version: pkg.version,
    effective_date: pkg.effective_date,
    description: pkg.description,
    jurisdiction: pkg.jurisdiction,
    reporting_authority: pkg.reporting_authority,
    field_count: pkg.field_count,
    mandatory_fields: pkg.mandatory_fields,
    conditional_fields: pkg.conditional_fields,
    optional_fields: pkg.optional_fields,
    validation_rule_count: pkg.validation_rule_count,
    output_format: pkg.output_format,
    tags: pkg.tags,
  }));
}
