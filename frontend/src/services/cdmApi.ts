/**
 * Common Domain Model (CDM) API Service
 *
 * API functions for working with the ISDA/FINOS Common Domain Model,
 * regulation packages, validation, and projection.
 *
 * CDM Reference: https://cdm.finos.org/
 */

import { api } from './api';

// === Types ===

export interface RegulationPackageSummary {
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
  tags: string[];
}

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
  cdm_path?: string;
  transform?: string;
  default_value?: string;
  xml_element?: string;
  validation_rules: string[];
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

export interface RegulationPackage extends RegulationPackageSummary {
  fields: FieldSpec[];
  validation_rules: ValidationRuleSpec[];
  output_schema?: string;
  output_namespace?: string;
  output_root_element?: string;
  created_at: string;
}

export interface CdmMapping {
  regulatory_field_id: string;
  regulatory_field_name: string;
  cdm_path: string;
  transform?: string;
  requirement: string;
  data_type: string;
}

export interface ValidationRequest {
  trade_event_ids: string[];
  regulations: string[];
  include_warnings?: boolean;
}

export interface ValidationResult {
  total_events: number;
  valid_events: number;
  invalid_events: number;
  total_errors: number;
  total_warnings: number;
  pass_rate: number;
  errors_by_field: Record<string, number>;
  errors_by_code: Record<string, number>;
  results: TradeEventValidationResult[];
}

export interface TradeEventValidationResult {
  trade_event_id: string;
  is_valid: boolean;
  error_count: number;
  warning_count: number;
  errors: FieldError[];
  warnings: FieldError[];
}

export interface FieldError {
  field: string;
  value?: string;
  code: string;
  message: string;
  regulation?: string;
}

export interface ProjectionRequest {
  trade_event_ids: string[];
  regulation: string;
  report_date?: string;
}

export interface ProjectionResult {
  regulation: string;
  record_count: number;
  error_count: number;
  projection_time_ms: number;
  records: ProjectedRecord[];
  errors: ProjectionError[];
}

export interface ProjectedRecord {
  source_id: string;
  trade_event_id: string;
  fields: Record<string, any>;
}

export interface ProjectionError {
  code: string;
  trade_event_id?: string;
  message: string;
}

export interface RulePackageRequest {
  trade_event_ids: string[];
  regulation: string;
  run_validation?: boolean;
  run_projection?: boolean;
  report_date?: string;
}

export interface RulePackageResult {
  regulation: string;
  trade_event_count: number;
  validation?: ValidationResult;
  projection?: ProjectionResult;
  valid_record_ids: string[];
}

export interface ReportConfig {
  name: string;
  description: string;
  regulation: string;
  version: string;
  output_format: string;
  schema: {
    namespace?: string;
    root_element?: string;
    schema_url?: string;
  };
  fields: any[];
  validation_rules: any[];
  metadata: {
    package_id: string;
    jurisdiction: string;
    reporting_authority: string;
    effective_date: string;
    tags: string[];
  };
}

// === API Functions ===

/**
 * List all available regulation packages
 */
export async function listPackages(): Promise<{ packages: RegulationPackageSummary[]; total: number }> {
  const response = await api.get('/cdm/packages');
  return response.data;
}

/**
 * Get a regulation package by ID or code
 */
export async function getPackage(
  packageId: string,
  options?: { includeFields?: boolean; includeRules?: boolean }
): Promise<RegulationPackage> {
  const params = new URLSearchParams();
  if (options?.includeFields !== undefined) {
    params.append('include_fields', String(options.includeFields));
  }
  if (options?.includeRules !== undefined) {
    params.append('include_rules', String(options.includeRules));
  }
  const response = await api.get(`/cdm/packages/${packageId}?${params.toString()}`);
  return response.data;
}

/**
 * Get fields for a regulation package
 */
export async function getPackageFields(
  packageId: string,
  options?: { requirement?: string; search?: string }
): Promise<{ package_id: string; regulation: string; total_fields: number; fields: FieldSpec[] }> {
  const params = new URLSearchParams();
  if (options?.requirement) {
    params.append('requirement', options.requirement);
  }
  if (options?.search) {
    params.append('search', options.search);
  }
  const response = await api.get(`/cdm/packages/${packageId}/fields?${params.toString()}`);
  return response.data;
}

/**
 * Get validation rules for a regulation package
 */
export async function getPackageRules(
  packageId: string,
  options?: { severity?: string; ruleType?: string }
): Promise<{ package_id: string; regulation: string; total_rules: number; rules: ValidationRuleSpec[] }> {
  const params = new URLSearchParams();
  if (options?.severity) {
    params.append('severity', options.severity);
  }
  if (options?.ruleType) {
    params.append('rule_type', options.ruleType);
  }
  const response = await api.get(`/cdm/packages/${packageId}/rules?${params.toString()}`);
  return response.data;
}

/**
 * Get CDM mapping for a package
 */
export async function getPackageMapping(
  packageId: string
): Promise<{ package_id: string; regulation: string; total_mappings: number; mappings: CdmMapping[] }> {
  const response = await api.get(`/cdm/packages/${packageId}/cdm-mapping`);
  return response.data;
}

/**
 * Generate a report configuration from a package
 */
export async function generateReportConfig(
  packageId: string
): Promise<{ package_id: string; regulation: string; config: ReportConfig; instructions: Record<string, string> }> {
  const response = await api.post(`/cdm/packages/${packageId}/generate-report-config`);
  return response.data;
}

/**
 * Validate trade events
 */
export async function validateTradeEvents(request: ValidationRequest): Promise<ValidationResult> {
  const response = await api.post('/cdm/validate', request);
  return response.data;
}

/**
 * Project trade events to a regulation format
 */
export async function projectTradeEvents(request: ProjectionRequest): Promise<ProjectionResult> {
  const response = await api.post('/cdm/project', request);
  return response.data;
}

/**
 * Execute a complete rule package (validate + project)
 */
export async function executeRulePackage(request: RulePackageRequest): Promise<RulePackageResult> {
  const response = await api.post('/cdm/execute-rules', request);
  return response.data;
}

/**
 * List supported regulations
 */
export async function listRegulations(): Promise<{ regulations: any[] }> {
  const response = await api.get('/cdm/regulations');
  return response.data;
}

/**
 * Get CDM version
 */
export async function getModelVersion(): Promise<any> {
  const response = await api.get('/cdm/versions/current');
  return response.data;
}

export default {
  listPackages,
  getPackage,
  getPackageFields,
  getPackageRules,
  getPackageMapping,
  generateReportConfig,
  validateTradeEvents,
  projectTradeEvents,
  executeRulePackage,
  listRegulations,
  getModelVersion,
};
