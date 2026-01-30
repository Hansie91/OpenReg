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
  condition?: string;
  cdm_path?: string;  // Path in the ISDA Common Domain Model (CDM)
  transform?: string;
  default_value?: string;
  xml_element?: string;
  validation_rules: string[];
  // For multi-report-type regulations: which report types this field applies to
  report_types?: string[];
}

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
  validation_rule_count: 25,
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
  validation_rule_count: 9,
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
  validation_rule_count: 25,
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
  validation_rule_count: 18,
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
  validation_rule_count: 22,
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
  validation_rule_count: 15,
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
  validation_rule_count: 14,
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
  validation_rule_count: 12,
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
  validation_rule_count: 12,
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
  validation_rule_count: 10,
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
