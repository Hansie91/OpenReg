import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  Layers,
  Code,
  Table,
  ListChecks,
  GitBranch,
  Globe,
  Building2,
  Calendar,
  Tag,
  Zap,
} from 'lucide-react';
import { getPackageById, RegulationPackage, FieldSpec, ValidationRuleSpec } from '../data/regulationPackages';
import { useToast } from '../store/toastStore';

// Tabs
type TabId = 'overview' | 'fields' | 'rules' | 'mapping' | 'export';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <FileText className="h-4 w-4" /> },
  { id: 'fields', label: 'Fields', icon: <Table className="h-4 w-4" /> },
  { id: 'rules', label: 'Validation Rules', icon: <ListChecks className="h-4 w-4" /> },
  { id: 'mapping', label: 'CDM Mapping', icon: <GitBranch className="h-4 w-4" /> },
  { id: 'export', label: 'Export / Import', icon: <Download className="h-4 w-4" /> },
];

// Regulation colors
const regulationColors: Record<string, { bg: string; text: string; border: string }> = {
  EMIR: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  MIFIR: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  SFTR: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
};

// Field requirement badge
function RequirementBadge({ requirement }: { requirement: string }) {
  const config = {
    mandatory: { bg: 'bg-red-100', text: 'text-red-700', label: 'Mandatory' },
    conditional: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Conditional' },
    optional: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Optional' },
  }[requirement] || { bg: 'bg-gray-100', text: 'text-gray-700', label: requirement };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

// Severity badge
function SeverityBadge({ severity }: { severity: string }) {
  const config = {
    ERROR: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertCircle className="h-3 w-3" /> },
    WARNING: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <AlertTriangle className="h-3 w-3" /> },
    INFO: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Info className="h-3 w-3" /> },
  }[severity] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: null };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
      {config.icon}
      {severity}
    </span>
  );
}

// Overview Tab
function OverviewTab({ pkg }: { pkg: RegulationPackage }) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-3xl font-bold text-gray-900">{pkg.field_count}</div>
          <div className="text-sm text-gray-500">Total Fields</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-3xl font-bold text-red-600">{pkg.mandatory_fields}</div>
          <div className="text-sm text-gray-500">Mandatory</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-3xl font-bold text-yellow-600">{pkg.conditional_fields}</div>
          <div className="text-sm text-gray-500">Conditional</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-3xl font-bold text-blue-600">{pkg.validation_rule_count}</div>
          <div className="text-sm text-gray-500">Validation Rules</div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
        <p className="text-gray-600">{pkg.description}</p>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Regulatory Information</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Jurisdiction
              </dt>
              <dd className="font-medium text-gray-900">{pkg.jurisdiction}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Authority
              </dt>
              <dd className="font-medium text-gray-900">{pkg.reporting_authority}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Effective Date
              </dt>
              <dd className="font-medium text-gray-900">{pkg.effective_date}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Output Configuration</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Format</dt>
              <dd className="font-medium text-gray-900">{pkg.output_format}</dd>
            </div>
            {pkg.output_namespace && (
              <div>
                <dt className="text-gray-500 mb-1">Namespace</dt>
                <dd className="font-mono text-xs text-gray-700 bg-gray-50 p-2 rounded break-all">
                  {pkg.output_namespace}
                </dd>
              </div>
            )}
            {pkg.output_root_element && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Root Element</dt>
                <dd className="font-mono text-sm text-gray-900">{pkg.output_root_element}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Tags */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {pkg.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
            >
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Fields Tab
function FieldsTab({ fields }: { fields: FieldSpec[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [requirementFilter, setRequirementFilter] = useState<string>('');
  const [expandedField, setExpandedField] = useState<string | null>(null);

  const filteredFields = useMemo(() => {
    return fields.filter((field) => {
      // Filter by requirement
      if (requirementFilter && field.requirement !== requirementFilter) {
        return false;
      }
      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          field.field_name.toLowerCase().includes(search) ||
          field.description.toLowerCase().includes(search) ||
          field.field_id.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [fields, searchTerm, requirementFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={requirementFilter}
          onChange={(e) => setRequirementFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Requirements</option>
          <option value="mandatory">Mandatory</option>
          <option value="conditional">Conditional</option>
          <option value="optional">Optional</option>
        </select>
      </div>

      {/* Field Count */}
      <div className="text-sm text-gray-500">
        Showing {filteredFields.length} of {fields.length} fields
      </div>

      {/* Fields List */}
      <div className="bg-white rounded-lg border divide-y">
        {filteredFields.map((field) => (
          <div key={field.field_id} className="p-4">
            <div
              className="flex items-start justify-between cursor-pointer"
              onClick={() => setExpandedField(expandedField === field.field_id ? null : field.field_id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-gray-400">{field.field_id}</span>
                  <span className="font-medium text-gray-900">{field.field_name}</span>
                  <RequirementBadge requirement={field.requirement} />
                </div>
                <p className="text-sm text-gray-500 mt-1">{field.description}</p>
              </div>
              {expandedField === field.field_id ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </div>

            {expandedField === field.field_id && (
              <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Data Type:</span>
                  <span className="ml-2 font-medium">{field.data_type}</span>
                </div>
                {field.max_length && (
                  <div>
                    <span className="text-gray-500">Max Length:</span>
                    <span className="ml-2 font-medium">{field.max_length}</span>
                  </div>
                )}
                {field.pattern && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Pattern:</span>
                    <code className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">{field.pattern}</code>
                  </div>
                )}
                {field.enum_values && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Allowed Values:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {field.enum_values.map((val) => (
                        <span key={val} className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                          {val}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {field.condition && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Condition:</span>
                    <span className="ml-2 text-yellow-700">{field.condition}</span>
                  </div>
                )}
                {field.cdm_path && (
                  <div className="col-span-2">
                    <span className="text-gray-500">CDM Path:</span>
                    <code className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                      {field.cdm_path}
                    </code>
                  </div>
                )}
                {field.xml_element && (
                  <div>
                    <span className="text-gray-500">XML Element:</span>
                    <code className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">{field.xml_element}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Validation Rules Tab
function RulesTab({ rules }: { rules: ValidationRuleSpec[] }) {
  const [severityFilter, setSeverityFilter] = useState<string>('');

  const filteredRules = useMemo(() => {
    if (!severityFilter) return rules;
    return rules.filter((rule) => rule.severity === severityFilter);
  }, [rules, severityFilter]);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-4">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Severities</option>
          <option value="ERROR">Error</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
        <span className="text-sm text-gray-500">
          {filteredRules.length} validation rules
        </span>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {filteredRules.map((rule) => (
          <div key={rule.rule_id} className="bg-white rounded-lg border p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-400">{rule.rule_id}</span>
                <span className="font-medium text-gray-900">{rule.name}</span>
              </div>
              <SeverityBadge severity={rule.severity} />
            </div>
            <p className="text-sm text-gray-600 mb-3">{rule.description}</p>

            <div className="bg-gray-50 rounded p-3 mb-3">
              <div className="text-xs text-gray-500 mb-1">Expression</div>
              <code className="text-xs text-gray-800 break-all">{rule.expression}</code>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-500">Error Message:</span>
                <span className="ml-2 text-red-600">{rule.error_message}</span>
              </div>
              {rule.affected_fields.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Affects:</span>
                  {rule.affected_fields.slice(0, 3).map((f) => (
                    <span key={f} className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                      {f}
                    </span>
                  ))}
                  {rule.affected_fields.length > 3 && (
                    <span className="text-xs text-gray-400">+{rule.affected_fields.length - 3} more</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// CDM Mapping Tab
function MappingTab({ fields }: { fields: FieldSpec[] }) {
  const mappings = useMemo(() => {
    return fields
      .filter((f) => f.cdm_path)
      .map((f) => ({
        regulatory_field_id: f.field_id,
        regulatory_field_name: f.field_name,
        cdm_path: f.cdm_path!,
        transform: f.transform,
        requirement: f.requirement,
        data_type: f.data_type,
      }));
  }, [fields]);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <GitBranch className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Common Domain Model (CDM) Mapping</h3>
            <p className="text-sm text-blue-700 mt-1">
              These mappings show how fields from the ISDA/FINOS Common Domain Model map to regulatory report fields.
              Use this when configuring your source data translation.
            </p>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-500">
        {mappings.length} mapped fields
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Field ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Regulatory Field
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                CDM Path
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Transform
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Requirement
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mappings.map((mapping) => (
              <tr key={mapping.regulatory_field_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm text-gray-500">
                  {mapping.regulatory_field_id}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {mapping.regulatory_field_name}
                </td>
                <td className="px-4 py-3">
                  <code className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                    {mapping.cdm_path}
                  </code>
                </td>
                <td className="px-4 py-3">
                  {mapping.transform ? (
                    <code className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                      {mapping.transform}
                    </code>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RequirementBadge requirement={mapping.requirement} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Export Tab
function ExportTab({ pkg }: { pkg: RegulationPackage }) {
  const { showSuccess } = useToast();

  const handleExportJson = () => {
    const json = JSON.stringify(pkg, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pkg.regulation_code.toLowerCase()}-package.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Package exported', 'JSON file downloaded successfully');
  };

  const handleCopyConfig = () => {
    const config = {
      name: `${pkg.regulation_code} Report`,
      description: pkg.description,
      regulation: pkg.regulation_code,
      version: pkg.version,
      output_format: pkg.output_format.toLowerCase(),
      schema: {
        namespace: pkg.output_namespace,
        root_element: pkg.output_root_element,
      },
      fields: pkg.fields.map((f) => ({
        id: f.field_id,
        name: f.field_name,
        xml_element: f.xml_element,
        data_type: f.data_type,
        required: f.requirement === 'mandatory',
        cdm_path: f.cdm_path,
        transform: f.transform,
      })),
      metadata: {
        package_id: pkg.package_id,
        jurisdiction: pkg.jurisdiction,
        reporting_authority: pkg.reporting_authority,
        effective_date: pkg.effective_date,
        tags: pkg.tags,
      },
    };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    showSuccess('Configuration copied', 'Report configuration copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Generate Report Config */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Create Report from Package</h3>
        <p className="text-sm text-gray-600 mb-4">
          Generate a report configuration from this package. This will create a ready-to-use
          configuration that includes all field mappings and validation rules.
        </p>
        <button
          onClick={handleCopyConfig}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Code className="h-4 w-4" />
          Copy Report Configuration
        </button>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Export Package</h3>
        <p className="text-sm text-gray-600 mb-4">
          Export the full package definition including all fields and validation rules.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export as JSON
          </button>
        </div>
      </div>

      {/* API Features Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-2">API Features (Optional)</h3>
            <p className="text-sm text-amber-800 mb-3">
              Connect to the OpenReg API for enhanced features:
            </p>
            <ul className="space-y-2 text-sm text-amber-800">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                Live validation of CDM data against regulatory rules
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                Projection to ISO 20022 XML report format
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                Automated report generation from CDM trade events
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-900 mb-3">Quick Start Guide</h3>
        <ol className="space-y-3 text-sm text-green-800">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-medium">
              1
            </span>
            <span>
              <strong>Copy Configuration:</strong> Click "Copy Report Configuration" above
              to get a report config based on this package.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-medium">
              2
            </span>
            <span>
              <strong>Create Source Mapping:</strong> Set up a source mapping to translate
              your source data to the Common Domain Model (CDM).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-medium">
              3
            </span>
            <span>
              <strong>Execute Translation:</strong> Run the translation to convert your data to the
              CDM format.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-green-200 rounded-full flex items-center justify-center text-green-800 font-medium">
              4
            </span>
            <span>
              <strong>Validate & Project:</strong> Use the rule engine to validate and project your
              CDM data to the {pkg.regulation_code} report format.
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

// Main Component
export default function PackageDetail() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Get package from bundled data (open source core)
  const pkg = packageId ? getPackageById(packageId) : undefined;

  if (!pkg) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          <span>Package not found: {packageId}</span>
        </div>
        <button
          onClick={() => navigate('/packages')}
          className="mt-4 text-sm text-red-600 hover:text-red-800"
        >
          ← Back to packages
        </button>
      </div>
    );
  }

  const colors = regulationColors[pkg.regulation_code] || regulationColors.EMIR;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/packages')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold ${colors.text}`}>{pkg.regulation_code}</span>
            <span className="text-gray-400">|</span>
            <span className="text-xl text-gray-700">{pkg.regulation_name}</span>
          </div>
          <p className="text-gray-500 mt-1">Version {pkg.version}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab pkg={pkg} />}
        {activeTab === 'fields' && <FieldsTab fields={pkg.fields} />}
        {activeTab === 'rules' && <RulesTab rules={pkg.validation_rules} />}
        {activeTab === 'mapping' && <MappingTab fields={pkg.fields} />}
        {activeTab === 'export' && <ExportTab pkg={pkg} />}
      </div>
    </div>
  );
}
