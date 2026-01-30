import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
    ArrowLeft,
    Play,
    Settings,
    FileText,
    Database,
    CheckCircle,
    AlertTriangle,
    Trash2,
    Save,
    ChevronDown,
    ChevronRight,
    Mail,
    Server,
    History,
} from 'lucide-react';
import { reportsAPI, validationsAPI, destinationsAPI } from '../services/api';
import { useToast } from '../store/toastStore';
import { ALL_PACKAGES } from '../data/regulationPackages';

// Tab types
type TabId = 'overview' | 'fields' | 'validations' | 'output' | 'delivery' | 'history';

interface Tab {
    id: TabId;
    name: string;
    icon: React.ReactNode;
}

const TABS: Tab[] = [
    { id: 'overview', name: 'Overview', icon: <FileText className="w-4 h-4" /> },
    { id: 'fields', name: 'Field Mappings', icon: <Database className="w-4 h-4" /> },
    { id: 'validations', name: 'Validations', icon: <CheckCircle className="w-4 h-4" /> },
    { id: 'output', name: 'Output Config', icon: <Settings className="w-4 h-4" /> },
    { id: 'delivery', name: 'Schedule & Delivery', icon: <Mail className="w-4 h-4" /> },
    { id: 'history', name: 'Version History', icon: <History className="w-4 h-4" /> },
];

// Helper to get global CDM mappings from localStorage
const getGlobalCdmMappings = (): any[] => {
    try {
        const saved = localStorage.getItem('cdm_mappings');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
};

// Output format options
const OUTPUT_FORMATS = [
    { value: 'xml', label: 'XML', description: 'Regulatory XML format (MiFIR, EMIR, SFTR)', regulatory: true },
    { value: 'json', label: 'JSON', description: 'Structured data interchange format', regulatory: false },
    { value: 'csv', label: 'CSV', description: 'Comma-separated values', regulatory: false },
    { value: 'xlsx', label: 'Excel', description: 'Microsoft Excel spreadsheet', regulatory: false },
    { value: 'pdf', label: 'PDF', description: 'Human-readable document', regulatory: false },
];

// Cron presets for quick selection
const CRON_PRESETS = [
    { label: 'Every hour', value: '0 * * * *', description: 'At minute 0 of every hour' },
    { label: 'Daily at 6 AM', value: '0 6 * * *', description: 'Every day at 06:00' },
    { label: 'Daily at midnight', value: '0 0 * * *', description: 'Every day at 00:00' },
    { label: 'Weekdays at 8 AM', value: '0 8 * * 1-5', description: 'Mon-Fri at 08:00' },
    { label: 'Weekly on Monday', value: '0 8 * * 1', description: 'Every Monday at 08:00' },
    { label: 'Monthly on 1st', value: '0 6 1 * *', description: '1st of each month at 06:00' },
    { label: 'Quarterly', value: '0 6 1 1,4,7,10 *', description: '1st of Jan, Apr, Jul, Oct' },
];

// Week days for calendar scheduling
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Timezone options
const TIMEZONES = [
    { value: 'UTC', label: 'UTC' },
    { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
    { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET/CEST)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
    { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
    { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
];

// Filename tokens
const FILENAME_TOKENS = [
    { token: '{report_name}', description: 'Report name' },
    { token: '{regulation}', description: 'Regulation code (EMIR, MiFIR, etc.)' },
    { token: '{date}', description: 'Date in configured format' },
    { token: '{datetime}', description: 'Date and time' },
    { token: '{year}', description: 'Year (4 digits)' },
    { token: '{month}', description: 'Month (2 digits)' },
    { token: '{day}', description: 'Day (2 digits)' },
    { token: '{version}', description: 'Report version' },
    { token: '{sequence}', description: 'Sequence number' },
    { token: '{ext}', description: 'File extension' },
];

// Date format options
const DATE_FORMATS = [
    { value: 'YYYYMMDD', label: 'YYYYMMDD', example: '20240115' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2024-01-15' },
    { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY', example: '15-01-2024' },
    { value: 'DDMMYYYY', label: 'DDMMYYYY', example: '15012024' },
    { value: 'YYYYMMDD_HHmmss', label: 'YYYYMMDD_HHmmss', example: '20240115_083000' },
];

// XML encoding options
const XML_ENCODINGS = [
    { value: 'UTF-8', label: 'UTF-8 (recommended)' },
    { value: 'UTF-16', label: 'UTF-16' },
    { value: 'ISO-8859-1', label: 'ISO-8859-1 (Latin-1)' },
];

// CSV delimiter options
const CSV_DELIMITERS = [
    { value: ',', label: 'Comma (,)' },
    { value: ';', label: 'Semicolon (;)' },
    { value: '\t', label: 'Tab' },
    { value: '|', label: 'Pipe (|)' },
];

// Line ending options
const LINE_ENDINGS = [
    { value: 'CRLF', label: 'Windows (CRLF)' },
    { value: 'LF', label: 'Unix (LF)' },
];

// Split modes
const SPLIT_MODES = [
    { value: 'none', label: 'No splitting', description: 'Single output file' },
    { value: 'records', label: 'By record count', description: 'Split when file exceeds record limit' },
    { value: 'field', label: 'By field value', description: 'Separate file per unique field value' },
];

// File numbering formats
const FILE_NUMBERING = [
    { value: 'numeric', label: '001, 002, 003...', example: '_001' },
    { value: 'alpha', label: 'A, B, C...', example: '_A' },
    { value: 'date_seq', label: 'Date + sequence', example: '_20260130_001' },
];


export default function ReportDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [validationSearchTerm, setValidationSearchTerm] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    // Validation management state
    const [showLibraryPicker, setShowLibraryPicker] = useState(false);
    const [showCustomRuleForm, setShowCustomRuleForm] = useState(false);
    const [librarySearchTerm, setLibrarySearchTerm] = useState('');
    const [customRule, setCustomRule] = useState({
        name: '',
        description: '',
        rule_type: 'expression',
        expression: '',
        severity: 'ERROR',
        error_message: '',
        affected_fields: [] as string[],
    });

    // Get global CDM mappings
    const globalCdmMappings = getGlobalCdmMappings();

    // Editable state
    const [editedConfig, setEditedConfig] = useState<any>(null);

    // Version history state
    const [selectedVersion, setSelectedVersion] = useState<any>(null);
    const [showVersionDetail, setShowVersionDetail] = useState(false);

    // Preview state
    const [previewMinified, setPreviewMinified] = useState(false);
    const [previewCopied, setPreviewCopied] = useState(false);
    const [previewWithRealData, setPreviewWithRealData] = useState(false);
    const [realDataLoading, setRealDataLoading] = useState(false);
    const [realDataSample, setRealDataSample] = useState<any[]>([]);

    // Edit report metadata state
    const [editingMetadata, setEditingMetadata] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [editedDescription, setEditedDescription] = useState('');

    // Fetch report details
    const { data: report, isLoading, error } = useQuery(
        ['report', id],
        async () => {
            const res = await reportsAPI.get(id!);
            return res.data;
        },
        {
            enabled: !!id,
            onSuccess: (data) => {
                if (!editedConfig) {
                    const cfg = data.config || {};
                    // If this is a package-based report, merge in the package data
                    if (cfg.package_id && (!cfg.fields || cfg.fields.length === 0)) {
                        const pkg = ALL_PACKAGES.find(p => p.package_id === cfg.package_id);
                        if (pkg) {
                            cfg.fields = pkg.fields.map(f => ({
                                field_id: f.field_id,
                                field_name: f.field_name,
                                description: f.description,
                                data_type: f.data_type,
                                requirement: f.requirement,
                                cdm_path: f.cdm_path,
                                xml_element: f.xml_element,
                                max_length: f.max_length,
                                pattern: f.pattern,
                                enum_values: f.enum_values,
                                source: null,
                                enabled: true
                            }));
                            cfg.validation_rules = pkg.validation_rules.map(r => ({
                                rule_id: r.rule_id,
                                name: r.name,
                                description: r.description,
                                severity: r.severity,
                                rule_type: r.rule_type,
                                expression: r.expression,
                                error_message: r.error_message,
                                affected_fields: r.affected_fields,
                                enabled: true
                            }));
                            cfg.schema = {
                                namespace: pkg.output_namespace,
                                root_element: pkg.output_root_element,
                                format: pkg.output_format
                            };
                            // Initialize CDM mappings from unique canonical paths
                            const uniquePaths = new Set(pkg.fields.map(f => f.cdm_path).filter(Boolean));
                            cfg.cdm_mappings = Array.from(uniquePaths).map(path => ({
                                cdm_path: path,
                                connector_id: null,
                                table_name: null,
                                column_name: null,
                                transformation: null
                            }));
                        }
                    }
                    // Ensure cdm_mappings exists
                    if (!cfg.cdm_mappings) {
                        const uniquePaths = new Set((cfg.fields || []).map((f: any) => f.cdm_path).filter(Boolean));
                        cfg.cdm_mappings = Array.from(uniquePaths).map(path => ({
                            cdm_path: path,
                            connector_id: null,
                            table_name: null,
                            column_name: null,
                            transformation: null
                        }));
                    }
                    setEditedConfig(cfg);
                }
            }
        }
    );

    // Fetch version history
    const { data: versions } = useQuery(
        ['report-versions', id],
        async () => {
            const res = await reportsAPI.getVersions(id!);
            return res.data;
        },
        { enabled: !!id && activeTab === 'history' }
    );

    // Fetch library validations (for picker)
    const { data: libraryValidations } = useQuery(
        'library-validations',
        async () => {
            const res = await validationsAPI.list();
            return res.data || [];
        },
        { enabled: showLibraryPicker }
    );

    // Fetch destinations library (for delivery tab)
    const { data: destinationsLibrary } = useQuery(
        'destinations-library',
        async () => {
            const res = await destinationsAPI.list();
            return res.data || [];
        },
        { enabled: activeTab === 'delivery' }
    );

    // Save changes mutation
    const saveMutation = useMutation(
        async () => {
            return reportsAPI.update(id!, {
                ...report,
                config: editedConfig
            });
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['report', id]);
                showSuccess('Changes Saved', 'Report configuration has been updated.');
                setHasChanges(false);
            },
            onError: (err: any) => {
                showError('Save Failed', err?.response?.data?.detail || 'Please try again.');
            }
        }
    );

    // Save metadata (name/description) - does NOT trigger version bump
    const saveMetadataMutation = useMutation(
        async (data: { name: string; description: string }) => {
            return reportsAPI.update(id!, {
                name: data.name,
                description: data.description
            });
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['report', id]);
                showSuccess('Report Updated', 'Name and description have been saved.');
                setEditingMetadata(false);
            },
            onError: (err: any) => {
                showError('Update Failed', err?.response?.data?.detail || 'Please try again.');
            }
        }
    );

    // Execute report mutation
    const executeMutation = useMutation(
        async () => {
            return reportsAPI.execute(id!);
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['report', id]);
                showSuccess('Report Started', 'The report execution has been started.');
            },
            onError: (err: any) => {
                showError('Execution Failed', err?.response?.data?.detail || 'Please try again.');
            }
        }
    );

    // Delete mutation
    const deleteMutation = useMutation(
        async () => {
            return reportsAPI.delete(id!);
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries('reports');
                showSuccess('Report Deleted', 'The report has been deleted.');
                navigate('/reports');
            },
            onError: (err: any) => {
                showError('Delete Failed', err?.response?.data?.detail || 'Please try again.');
            }
        }
    );

    // Update config helper
    const updateConfig = (path: string, value: any) => {
        setEditedConfig((prev: any) => {
            const parts = path.split('.');
            const newConfig = { ...prev };
            let current: any = newConfig;
            for (let i = 0; i < parts.length - 1; i++) {
                current[parts[i]] = { ...current[parts[i]] };
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = value;
            return newConfig;
        });
        setHasChanges(true);
    };

    // Toggle validation rule
    const toggleValidationRule = (ruleId: string) => {
        setEditedConfig((prev: any) => {
            const rules = prev.validation_rules?.map((r: any) =>
                r.rule_id === ruleId ? { ...r, enabled: !r.enabled } : r
            );
            return { ...prev, validation_rules: rules };
        });
        setHasChanges(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner w-8 h-8"></div>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-lg font-medium text-gray-900">Report not found</h2>
                <p className="text-gray-500 mt-2">The report you're looking for doesn't exist.</p>
                <Link to="/reports" className="btn btn-primary mt-4">
                    Back to Reports
                </Link>
            </div>
        );
    }

    const config = editedConfig || report.config || {};

    // Load package data if this report is based on a package
    const packageData = config.package_id
        ? ALL_PACKAGES.find(p => p.package_id === config.package_id)
        : null;

    // Use fields from config, or fall back to package data
    const fields = config.fields?.length > 0
        ? config.fields
        : packageData?.fields.map(f => ({
            field_id: f.field_id,
            field_name: f.field_name,
            description: f.description,
            data_type: f.data_type,
            requirement: f.requirement,
            cdm_path: f.cdm_path,
            xml_element: f.xml_element,
            max_length: f.max_length,
            pattern: f.pattern,
            enum_values: f.enum_values,
            source: null, // Data source mapping to be configured
            enabled: true
        })) || [];

    // Use validation rules from config, or fall back to package data
    const validationRules = config.validation_rules?.length > 0
        ? config.validation_rules
        : packageData?.validation_rules.map(r => ({
            rule_id: r.rule_id,
            name: r.name,
            description: r.description,
            severity: r.severity,
            rule_type: r.rule_type,
            expression: r.expression,
            error_message: r.error_message,
            affected_fields: r.affected_fields,
            enabled: true // All rules enabled by default
        })) || [];

    // Get unique CDM paths from fields
    const uniqueCdmPaths = [...new Set(fields.map((f: any) => f.cdm_path).filter(Boolean))];

    // Count how many of this report's CDM paths have global CDM mappings
    const mappedCdmCount = uniqueCdmPaths.filter(path =>
        globalCdmMappings.some((m: any) => m.cdm_path === path && m.connector_id && m.column_name)
    ).length;

    // Filter fields by search
    const filteredFields = fields.filter((f: any) => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            f.field_name?.toLowerCase().includes(search) ||
            f.field_id?.toLowerCase().includes(search) ||
            f.cdm_path?.toLowerCase().includes(search)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/reports')} className="btn btn-ghost btn-icon">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    {editingMetadata ? (
                        <div className="space-y-2">
                            <input
                                type="text"
                                className="text-2xl font-bold text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={editedName}
                                onChange={e => setEditedName(e.target.value)}
                                placeholder="Report name"
                                autoFocus
                            />
                            <input
                                type="text"
                                className="text-gray-500 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={editedDescription}
                                onChange={e => setEditedDescription(e.target.value)}
                                placeholder="Description (optional)"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => saveMetadataMutation.mutate({ name: editedName, description: editedDescription })}
                                    disabled={!editedName.trim() || saveMetadataMutation.isLoading}
                                    className="btn btn-primary btn-sm"
                                >
                                    {saveMetadataMutation.isLoading ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={() => setEditingMetadata(false)}
                                    className="btn btn-ghost btn-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="group relative">
                            <h1 className="text-2xl font-bold text-gray-900">{report.name}</h1>
                            <p className="text-gray-500">{report.description || <span className="italic text-gray-400">No description</span>}</p>
                            <button
                                onClick={() => {
                                    setEditedName(report.name);
                                    setEditedDescription(report.description || '');
                                    setEditingMetadata(true);
                                }}
                                className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                                title="Edit name and description"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isLoading}
                            className="btn btn-primary"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {saveMutation.isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                    <button
                        onClick={() => executeMutation.mutate()}
                        disabled={executeMutation.isLoading}
                        className="btn btn-success"
                    >
                        <Play className="w-4 h-4 mr-2" />
                        {executeMutation.isLoading ? 'Starting...' : 'Run Report'}
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to delete this report?')) {
                                deleteMutation.mutate();
                            }
                        }}
                        className="btn btn-ghost text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.icon}
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-3 gap-6">
                        <div className="col-span-2 space-y-6">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="card p-4">
                                    <div className="text-2xl font-bold text-gray-900">{fields.length}</div>
                                    <div className="text-sm text-gray-500">Total Fields</div>
                                </div>
                                <div className="card p-4">
                                    <div className="text-2xl font-bold text-red-600">
                                        {fields.filter((f: any) => f.requirement === 'mandatory').length}
                                    </div>
                                    <div className="text-sm text-gray-500">Mandatory</div>
                                </div>
                                <div className="card p-4">
                                    <div className="text-2xl font-bold text-blue-600">{validationRules.length}</div>
                                    <div className="text-sm text-gray-500">Validation Rules</div>
                                </div>
                                <div className="card p-4">
                                    <div className={`text-2xl font-bold ${mappedCdmCount === uniqueCdmPaths.length ? 'text-green-600' : 'text-amber-600'}`}>
                                        {mappedCdmCount}/{uniqueCdmPaths.length}
                                    </div>
                                    <div className="text-sm text-gray-500">CDM Mapped</div>
                                </div>
                            </div>

                            {/* Configuration Summary */}
                            <div className="card p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration</h3>
                                <dl className="grid grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-sm text-gray-500">Regulation</dt>
                                        <dd className="text-sm font-medium text-gray-900">{config.regulation || 'Custom'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-gray-500">Version</dt>
                                        <dd className="text-sm font-medium text-gray-900">{config.version || '1.0'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-gray-500">Output Format</dt>
                                        <dd className="text-sm font-medium text-gray-900">{config.output_format?.toUpperCase() || 'XML'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-gray-500">Schedule</dt>
                                        <dd className="text-sm font-medium text-gray-900 capitalize">{config.schedule?.frequency || 'Manual'}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Package Info */}
                            {packageData && (
                                <div className={`card p-6 ${
                                    packageData.regulation_code === 'EMIR' ? 'bg-blue-50 border-blue-200' :
                                    packageData.regulation_code === 'MIFIR' ? 'bg-purple-50 border-purple-200' :
                                    'bg-green-50 border-green-200'
                                }`}>
                                    <h3 className="text-lg font-medium text-gray-900 mb-3">Package</h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xl font-bold ${
                                                packageData.regulation_code === 'EMIR' ? 'text-blue-600' :
                                                packageData.regulation_code === 'MIFIR' ? 'text-purple-600' :
                                                'text-green-600'
                                            }`}>
                                                {packageData.regulation_code}
                                            </span>
                                            <span className="text-xs text-gray-500">{packageData.version}</span>
                                        </div>
                                        <p className="text-sm text-gray-600">{packageData.regulation_name}</p>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            <span className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-600">
                                                {packageData.jurisdiction}
                                            </span>
                                            <span className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-600">
                                                {packageData.reporting_authority}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="card p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Schema</h3>
                                <dl className="space-y-3">
                                    <div>
                                        <dt className="text-xs text-gray-500">Namespace</dt>
                                        <dd className="text-xs font-mono text-gray-700 break-all">{config.schema?.namespace || packageData?.output_namespace || '-'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-gray-500">Root Element</dt>
                                        <dd className="text-sm font-medium text-gray-900">{config.schema?.root_element || packageData?.output_root_element || '-'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-gray-500">Format</dt>
                                        <dd className="text-sm font-medium text-gray-900">{config.schema?.format || packageData?.output_format || '-'}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fields Tab - Shows Field → CDM Path mapping */}
                {activeTab === 'fields' && (
                    <div className="space-y-4">
                        {/* Info banner */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                            <strong>Field Mappings</strong> — Shows how report fields map to the CDM (Common Domain Model).
                            Configure data sources globally in the <Link to="/cdm" className="underline font-medium">CDM</Link> page.
                        </div>

                        {/* Search */}
                        <div className="flex items-center justify-between">
                            <input
                                type="text"
                                className="input max-w-md"
                                placeholder="Search fields..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <div className="text-sm text-gray-500">
                                {fields.length} fields in this report
                            </div>
                        </div>

                        {/* Fields table */}
                        <div className="card overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report Field</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12"></th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CDM Path</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Type</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredFields.map((field: any) => {
                                        const isExpanded = expandedFields.has(field.field_id);
                                        // Check if this field's CDM path is mapped globally
                                        const cdmMapping = globalCdmMappings.find((m: any) => m.cdm_path === field.cdm_path);
                                        const isCdmMapped = cdmMapping?.connector_id && cdmMapping?.column_name;
                                        return (
                                            <>
                                                <tr key={field.field_id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => {
                                                                const newExpanded = new Set(expandedFields);
                                                                if (isExpanded) {
                                                                    newExpanded.delete(field.field_id);
                                                                } else {
                                                                    newExpanded.add(field.field_id);
                                                                }
                                                                setExpandedFields(newExpanded);
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900">{field.field_name}</div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs text-gray-400">{field.field_id}</span>
                                                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                                                                field.requirement === 'mandatory'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : field.requirement === 'conditional'
                                                                        ? 'bg-yellow-100 text-yellow-700'
                                                                        : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                                {field.requirement}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-gray-400">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 inline">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                                        </svg>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <code className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                                                {field.cdm_path || '-'}
                                                            </code>
                                                            {isCdmMapped ? (
                                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                                            ) : field.cdm_path ? (
                                                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        {field.data_type}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-gray-50">
                                                        <td></td>
                                                        <td colSpan={4} className="px-4 py-4">
                                                            <div className="grid grid-cols-4 gap-4 text-sm">
                                                                <div>
                                                                    <dt className="text-gray-500">Max Length</dt>
                                                                    <dd className="font-medium">{field.max_length || '-'}</dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-gray-500">Pattern</dt>
                                                                    <dd className="font-mono text-xs">{field.pattern || '-'}</dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-gray-500">XML Element</dt>
                                                                    <dd className="font-mono text-xs">{field.xml_element || '-'}</dd>
                                                                </div>
                                                                <div>
                                                                    <dt className="text-gray-500">Condition</dt>
                                                                    <dd className="text-xs">{field.condition || '-'}</dd>
                                                                </div>
                                                                <div className="col-span-4">
                                                                    <dt className="text-gray-500">Description</dt>
                                                                    <dd>{field.description || '-'}</dd>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Validations Tab */}
                {activeTab === 'validations' && (() => {
                    // Categorize validations by source
                    const packageRules = validationRules.filter((r: any) => r.source === 'package' || (!r.source && r.rule_id?.includes('_VR')));
                    const libraryRules = validationRules.filter((r: any) => r.source === 'library');
                    const customRules = validationRules.filter((r: any) => r.source === 'custom');

                    // Filter validations by search term
                    const filterRules = (rules: any[]) => {
                        if (!validationSearchTerm) return rules;
                        const search = validationSearchTerm.toLowerCase();
                        return rules.filter((rule: any) =>
                            rule.name?.toLowerCase().includes(search) ||
                            rule.rule_id?.toLowerCase().includes(search) ||
                            rule.description?.toLowerCase().includes(search) ||
                            rule.expression?.toLowerCase().includes(search) ||
                            rule.error_message?.toLowerCase().includes(search) ||
                            rule.rule_type?.toLowerCase().includes(search) ||
                            rule.affected_fields?.some((f: string) => f.toLowerCase().includes(search))
                        );
                    };

                    // Add validation from library
                    const addFromLibrary = (libraryRule: any) => {
                        const newRule = {
                            ...libraryRule,
                            rule_id: `LIB_${libraryRule.id}`,
                            source: 'library',
                            library_id: libraryRule.id,
                            enabled: true
                        };
                        setEditedConfig((prev: any) => ({
                            ...prev,
                            validation_rules: [...(prev.validation_rules || []), newRule]
                        }));
                        setHasChanges(true);
                        setShowLibraryPicker(false);
                    };

                    // Remove a non-package validation
                    const removeValidation = (ruleId: string) => {
                        setEditedConfig((prev: any) => ({
                            ...prev,
                            validation_rules: (prev.validation_rules || []).filter((r: any) => r.rule_id !== ruleId)
                        }));
                        setHasChanges(true);
                    };

                    // Add custom validation
                    const addCustomRule = () => {
                        if (!customRule.name || !customRule.expression) return;
                        const newRule = {
                            ...customRule,
                            rule_id: `CUSTOM_${Date.now()}`,
                            source: 'custom',
                            enabled: true
                        };
                        setEditedConfig((prev: any) => ({
                            ...prev,
                            validation_rules: [...(prev.validation_rules || []), newRule]
                        }));
                        setHasChanges(true);
                        setShowCustomRuleForm(false);
                        setCustomRule({
                            name: '',
                            description: '',
                            rule_type: 'expression',
                            expression: '',
                            severity: 'ERROR',
                            error_message: '',
                            affected_fields: [],
                        });
                    };

                    // Check if library rule is already added
                    const isLibraryRuleAdded = (libraryId: string) => {
                        return validationRules.some((r: any) => r.library_id === libraryId);
                    };

                    // Render a validation rule row
                    const renderRule = (rule: any, canRemove: boolean = false) => (
                        <div
                            key={rule.rule_id}
                            className={`px-4 py-2.5 hover:bg-gray-50 ${rule.enabled ? '' : 'opacity-50 bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    onChange={() => toggleValidationRule(rule.rule_id)}
                                    className="flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-gray-900 text-sm">{rule.name}</span>
                                        <code className="text-xs text-gray-400">{rule.rule_id}</code>
                                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                                            rule.severity === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {rule.severity}
                                        </span>
                                        {rule.rule_type && (
                                            <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                                                {rule.rule_type}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                        <span className="truncate">{rule.description}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 max-w-md truncate">
                                            {rule.expression}
                                        </code>
                                        {rule.affected_fields?.slice(0, 3).map((fieldId: string) => (
                                            <span key={fieldId} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                                                {fieldId}
                                            </span>
                                        ))}
                                        {rule.affected_fields?.length > 3 && (
                                            <span className="text-xs text-gray-400">+{rule.affected_fields.length - 3}</span>
                                        )}
                                    </div>
                                </div>
                                {canRemove && (
                                    <button
                                        onClick={() => removeValidation(rule.rule_id)}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                        title="Remove"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );

                    return (
                        <div className="space-y-4">
                            {/* Header with search and actions */}
                            <div className="flex items-center justify-between gap-4">
                                <input
                                    type="text"
                                    className="input max-w-md"
                                    placeholder="Search validations..."
                                    value={validationSearchTerm}
                                    onChange={e => setValidationSearchTerm(e.target.value)}
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowLibraryPicker(true)}
                                        className="btn btn-secondary text-sm"
                                    >
                                        + Add from Library
                                    </button>
                                    <button
                                        onClick={() => setShowCustomRuleForm(true)}
                                        className="btn btn-secondary text-sm"
                                    >
                                        + Custom Rule
                                    </button>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex gap-4 text-sm text-gray-500">
                                <span>{validationRules.filter((r: any) => r.enabled).length} of {validationRules.length} enabled</span>
                                <span className="text-purple-600">{packageRules.length} package</span>
                                <span className="text-blue-600">{libraryRules.length} library</span>
                                <span className="text-green-600">{customRules.length} custom</span>
                            </div>

                            {/* Package Validations */}
                            {filterRules(packageRules).length > 0 && (
                                <div className="card overflow-hidden">
                                    <div className="px-4 py-2 bg-purple-50 border-b border-purple-100">
                                        <span className="text-sm font-medium text-purple-700">
                                            Package Validations ({packageRules.length})
                                        </span>
                                        <span className="text-xs text-purple-500 ml-2">From {packageData?.regulation_code || 'regulation'} package</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {filterRules(packageRules).map((rule: any) => renderRule(rule, false))}
                                    </div>
                                </div>
                            )}

                            {/* Library Validations */}
                            {filterRules(libraryRules).length > 0 && (
                                <div className="card overflow-hidden">
                                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                                        <span className="text-sm font-medium text-blue-700">
                                            Library Validations ({libraryRules.length})
                                        </span>
                                        <span className="text-xs text-blue-500 ml-2">Reusable rules from global library</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {filterRules(libraryRules).map((rule: any) => renderRule(rule, true))}
                                    </div>
                                </div>
                            )}

                            {/* Custom Validations */}
                            {filterRules(customRules).length > 0 && (
                                <div className="card overflow-hidden">
                                    <div className="px-4 py-2 bg-green-50 border-b border-green-100">
                                        <span className="text-sm font-medium text-green-700">
                                            Custom Validations ({customRules.length})
                                        </span>
                                        <span className="text-xs text-green-500 ml-2">Report-specific rules</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {filterRules(customRules).map((rule: any) => renderRule(rule, true))}
                                    </div>
                                </div>
                            )}

                            {/* Empty state */}
                            {validationRules.length === 0 && (
                                <div className="card p-8 text-center text-gray-500">
                                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>No validation rules defined</p>
                                    <p className="text-sm mt-1">Add rules from the library or create custom ones</p>
                                </div>
                            )}

                            {/* Library Picker Modal */}
                            {showLibraryPicker && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLibraryPicker(false)}>
                                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="px-6 py-4 border-b flex items-center justify-between">
                                            <h3 className="text-lg font-semibold">Add from Validation Library</h3>
                                            <button onClick={() => setShowLibraryPicker(false)} className="text-gray-400 hover:text-gray-600">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="p-4 border-b">
                                            <input
                                                type="text"
                                                className="input w-full"
                                                placeholder="Search library validations..."
                                                value={librarySearchTerm}
                                                onChange={e => setLibrarySearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="overflow-y-auto max-h-96 divide-y">
                                            {(libraryValidations || [])
                                                .filter((r: any) => {
                                                    if (!librarySearchTerm) return true;
                                                    const s = librarySearchTerm.toLowerCase();
                                                    return r.name?.toLowerCase().includes(s) || r.description?.toLowerCase().includes(s);
                                                })
                                                .map((rule: any) => (
                                                    <div key={rule.id} className="px-6 py-3 hover:bg-gray-50 flex items-center justify-between">
                                                        <div>
                                                            <div className="font-medium text-gray-900">{rule.name}</div>
                                                            <div className="text-sm text-gray-500">{rule.description}</div>
                                                            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">{rule.expression}</code>
                                                        </div>
                                                        {isLibraryRuleAdded(rule.id) ? (
                                                            <span className="text-sm text-green-600">Added</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => addFromLibrary(rule)}
                                                                className="btn btn-primary text-sm"
                                                            >
                                                                Add
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            {(!libraryValidations || libraryValidations.length === 0) && (
                                                <div className="px-6 py-8 text-center text-gray-500">
                                                    No validation rules in the library yet.
                                                    <br />
                                                    <Link to="/validations" className="text-indigo-600 hover:underline">
                                                        Create rules in the Validation Library
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Custom Rule Form Modal */}
                            {showCustomRuleForm && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCustomRuleForm(false)}>
                                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                                        <div className="px-6 py-4 border-b flex items-center justify-between">
                                            <h3 className="text-lg font-semibold">Create Custom Validation Rule</h3>
                                            <button onClick={() => setShowCustomRuleForm(false)} className="text-gray-400 hover:text-gray-600">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div>
                                                <label className="input-label">Rule Name *</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="e.g., Minimum Amount Check"
                                                    value={customRule.name}
                                                    onChange={e => setCustomRule({ ...customRule, name: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label">Description</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="What does this rule check?"
                                                    value={customRule.description}
                                                    onChange={e => setCustomRule({ ...customRule, description: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="input-label">Severity</label>
                                                    <select
                                                        className="input"
                                                        value={customRule.severity}
                                                        onChange={e => setCustomRule({ ...customRule, severity: e.target.value })}
                                                    >
                                                        <option value="ERROR">ERROR (blocking)</option>
                                                        <option value="WARNING">WARNING</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="input-label">Rule Type</label>
                                                    <select
                                                        className="input"
                                                        value={customRule.rule_type}
                                                        onChange={e => setCustomRule({ ...customRule, rule_type: e.target.value })}
                                                    >
                                                        <option value="expression">Expression</option>
                                                        <option value="format">Format</option>
                                                        <option value="cross_field">Cross-field</option>
                                                        <option value="lookup">Lookup</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="input-label">Expression *</label>
                                                <input
                                                    type="text"
                                                    className="input font-mono"
                                                    placeholder="e.g., field.amount > 0"
                                                    value={customRule.expression}
                                                    onChange={e => setCustomRule({ ...customRule, expression: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label">Error Message</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Message shown when validation fails"
                                                    value={customRule.error_message}
                                                    onChange={e => setCustomRule({ ...customRule, error_message: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                                            <button onClick={() => setShowCustomRuleForm(false)} className="btn btn-ghost">
                                                Cancel
                                            </button>
                                            <button
                                                onClick={addCustomRule}
                                                disabled={!customRule.name || !customRule.expression}
                                                className="btn btn-primary"
                                            >
                                                Add Rule
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Output Config Tab */}
                {activeTab === 'output' && (() => {
                    const currentFormat = config.output_format || 'xml';

                    // Generate filename preview
                    const filenamePattern = config.filename?.pattern || '{report_name}_{date}.{ext}';
                    const filenamePreview = filenamePattern
                        .replace('{report_name}', report?.name?.replace(/\s+/g, '_') || 'Report')
                        .replace('{regulation}', packageData?.regulation_code || 'REG')
                        .replace('{date}', '20240115')
                        .replace('{datetime}', '20240115_083000')
                        .replace('{year}', '2024')
                        .replace('{month}', '01')
                        .replace('{day}', '15')
                        .replace('{version}', 'v1.0')
                        .replace('{sequence}', '001')
                        .replace('{ext}', currentFormat);

                    // Get sample fields for preview
                    const sampleFields = (config.fields || []).slice(0, 5);
                    const rootElement = config.xml?.root_element || packageData?.output_root_element || 'Report';
                    const namespace = config.xml?.namespace || packageData?.output_namespace || '';

                    // Generate preview content based on format
                    const generatePreview = () => {
                        // Get data to show - either real sample data or placeholder
                        const dataRecords = previewWithRealData && realDataSample.length > 0
                            ? realDataSample
                            : null;

                        if (currentFormat === 'xml') {
                            // Use config pretty_print setting, but allow preview toggle to override
                            const xmlPrettyPrint = previewMinified ? false : (config.xml?.pretty_print !== false);

                            const declaration = config.xml?.include_declaration !== false
                                ? `<?xml version="${config.xml?.version || '1.0'}" encoding="${config.xml?.encoding || 'UTF-8'}"?>${xmlPrettyPrint ? '\n' : ''}`
                                : '';
                            const nsAttr = namespace ? ` xmlns="${namespace}"` : '';
                            const schemaAttr = config.xml?.schema_location ? `${xmlPrettyPrint ? '\n         ' : ' '}xsi:schemaLocation="${namespace} ${config.xml.schema_location}"` : '';
                            const xsiAttr = config.xml?.schema_location ? ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' : '';
                            const indent = xmlPrettyPrint ? '  ' : '';
                            const newline = xmlPrettyPrint ? '\n' : '';
                            const cdataFields = config.xml?.cdata_fields || [];

                            let content = declaration;
                            content += `<${rootElement}${nsAttr}${xsiAttr}${schemaAttr}>${newline}`;
                            if (config.xml?.include_timestamp !== false) {
                                content += `${indent}<CreationTimestamp>2024-01-15T08:30:00Z</CreationTimestamp>${newline}`;
                            }
                            if (config.xml?.include_record_count !== false) {
                                const count = dataRecords ? dataRecords.length : 1247;
                                content += `${indent}<RecordCount>${count.toLocaleString()}</RecordCount>${newline}`;
                            }
                            content += `${indent}<Records>${newline}`;

                            if (dataRecords) {
                                // Show real data records
                                dataRecords.forEach((record: any, idx: number) => {
                                    content += `${indent}${indent}<Record>${newline}`;
                                    sampleFields.forEach((f: any) => {
                                        const tag = f.xml_element || f.field_name;
                                        const isCdata = cdataFields.includes(f.field_name);
                                        const value = record[f.source_field] ?? record[f.field_name] ?? '';
                                        if (isCdata) {
                                            content += `${indent}${indent}${indent}<${tag}><![CDATA[${value}]]></${tag}>${newline}`;
                                        } else {
                                            content += `${indent}${indent}${indent}<${tag}>${value}</${tag}>${newline}`;
                                        }
                                    });
                                    if (sampleFields.length < (config.fields || []).length) {
                                        content += `${indent}${indent}${indent}<!-- ... ${(config.fields || []).length - sampleFields.length} more fields -->${newline}`;
                                    }
                                    content += `${indent}${indent}</Record>${newline}`;
                                });
                            } else {
                                // Show placeholder
                                content += `${indent}${indent}<Record>${newline}`;
                                sampleFields.forEach((f: any) => {
                                    const tag = f.xml_element || f.field_name;
                                    const isCdata = cdataFields.includes(f.field_name);
                                    if (isCdata) {
                                        content += `${indent}${indent}${indent}<${tag}><![CDATA[...]]></${tag}>${newline}`;
                                    } else {
                                        content += `${indent}${indent}${indent}<${tag}>...</${tag}>${newline}`;
                                    }
                                });
                                if (sampleFields.length < (config.fields || []).length) {
                                    content += `${indent}${indent}${indent}<!-- ... ${(config.fields || []).length - sampleFields.length} more fields -->${newline}`;
                                }
                                content += `${indent}${indent}</Record>${newline}`;
                                content += `${indent}${indent}<!-- ... more records -->${newline}`;
                            }

                            content += `${indent}</Records>${newline}`;
                            content += `</${rootElement}>`;
                            return content;
                        } else if (currentFormat === 'csv') {
                            const delim = config.csv?.delimiter || ',';
                            const quote = config.csv?.quote_char || '"';
                            const quoteAll = config.csv?.quote_all;
                            const wrap = (v: string) => quoteAll ? `${quote}${v}${quote}` : v;

                            let content = '';

                            // BOM indicator
                            if (config.csv?.include_bom) {
                                content += '// BOM: EF BB BF (UTF-8 Byte Order Mark)\n';
                            }

                            // Header row
                            if (config.csv?.include_header !== false) {
                                if (config.csv?.custom_header) {
                                    content += config.csv.custom_header;
                                } else {
                                    content += sampleFields.map((f: any) => wrap(f.field_name)).join(delim);
                                    if (sampleFields.length < (config.fields || []).length) {
                                        content += `${delim}...`;
                                    }
                                }
                                content += '\n';
                            }

                            // Data rows
                            if (dataRecords) {
                                dataRecords.forEach((record: any) => {
                                    content += sampleFields.map((f: any) => {
                                        const value = record[f.source_field] ?? record[f.field_name] ?? '';
                                        return wrap(String(value));
                                    }).join(delim);
                                    content += '\n';
                                });
                            } else {
                                content += sampleFields.map(() => wrap('...')).join(delim);
                                content += '\n';
                                content += sampleFields.map(() => wrap('...')).join(delim);
                                content += '\n... (1,245 more rows)';
                            }

                            // Trailer row
                            if (config.csv?.include_trailer) {
                                content += '\n';
                                const count = dataRecords ? dataRecords.length : 1247;
                                if (config.csv?.trailer_text) {
                                    let trailer = config.csv.trailer_text;
                                    trailer = trailer.replace('{record_count}', String(count));
                                    trailer = trailer.replace('{timestamp}', '2024-01-15T08:30:00Z');
                                    content += trailer;
                                } else {
                                    const parts = ['END'];
                                    if (config.csv?.trailer_record_count !== false) parts.push(String(count));
                                    if (config.csv?.trailer_timestamp) parts.push('2024-01-15T08:30:00Z');
                                    content += parts.join(delim);
                                }
                            }

                            // Show line ending info
                            content += `\n\n// Line ending: ${config.csv?.line_ending || 'CRLF'}`;
                            return content;
                        } else if (currentFormat === 'json') {
                            // Use config pretty_print setting, but allow preview toggle to override
                            const jsonPrettyPrint = previewMinified ? false : (config.json?.pretty_print !== false);
                            const indent = jsonPrettyPrint ? 2 : 0;
                            const obj: any = {};

                            if (config.json?.include_metadata) {
                                obj.metadata = {
                                    report: report?.name,
                                    generated: '2024-01-15T08:30:00Z',
                                    record_count: dataRecords ? dataRecords.length : 1247
                                };
                            }

                            if (dataRecords) {
                                // Show real data
                                obj.records = dataRecords.map((record: any) => {
                                    const mapped: any = {};
                                    sampleFields.forEach((f: any) => {
                                        const value = record[f.source_field] ?? record[f.field_name];
                                        if (config.json?.null_handling === 'omit' && value == null) {
                                            return;
                                        } else if (config.json?.null_handling === 'empty_string' && value == null) {
                                            mapped[f.field_name] = '';
                                        } else {
                                            mapped[f.field_name] = value ?? null;
                                        }
                                    });
                                    return mapped;
                                });
                            } else {
                                // Show placeholder
                                obj.records = [
                                    sampleFields.reduce((acc: any, f: any) => {
                                        acc[f.field_name] = '...';
                                        return acc;
                                    }, {}),
                                    { '...': 'more records' }
                                ];
                            }

                            return JSON.stringify(config.json?.wrap_in_array !== false ? obj : obj.records, null, indent);
                        }
                        return '// Preview not available for this format';
                    };

                    return (
                        <div className="grid grid-cols-5 gap-6">
                            {/* Left Column: Configuration (2/5 width) */}
                            <div className="col-span-2 space-y-6">
                                {/* Output Format */}
                                <div className="card p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-medium text-gray-900">Output Format</h3>
                                        {packageData && (
                                            <span className="text-xs text-gray-500">
                                                Default: {packageData.output_format?.toUpperCase() || 'XML'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {OUTPUT_FORMATS.map(format => (
                                            <button
                                                key={format.value}
                                                onClick={() => updateConfig('output_format', format.value)}
                                                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                                                    currentFormat === format.value
                                                        ? 'border-indigo-500 bg-indigo-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="text-xl mb-1">
                                                    {format.value === 'xml' ? '📄' :
                                                     format.value === 'json' ? '{ }' :
                                                     format.value === 'csv' ? '📊' :
                                                     format.value === 'xlsx' ? '📗' : '📝'}
                                                </div>
                                                <div className="font-medium text-gray-900 text-sm">{format.label}</div>
                                                {format.regulatory && (
                                                    <div className="text-xs text-green-600 mt-1">Regulatory</div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Format-Specific Settings */}
                                {currentFormat === 'xml' && (
                                    <div className="card p-6">
                                        <h3 className="text-lg font-medium text-gray-900 mb-4">XML Settings</h3>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="input-label">Encoding</label>
                                                    <select
                                                        className="input"
                                                        value={config.xml?.encoding || 'UTF-8'}
                                                        onChange={e => updateConfig('xml.encoding', e.target.value)}
                                                    >
                                                        {XML_ENCODINGS.map(enc => (
                                                            <option key={enc.value} value={enc.value}>{enc.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="input-label">XML Version</label>
                                                    <select
                                                        className="input"
                                                        value={config.xml?.version || '1.0'}
                                                        onChange={e => updateConfig('xml.version', e.target.value)}
                                                    >
                                                        <option value="1.0">1.0</option>
                                                        <option value="1.1">1.1</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="input-label">Root Element</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder={packageData?.output_root_element || 'Report'}
                                                    value={config.xml?.root_element || ''}
                                                    onChange={e => updateConfig('xml.root_element', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label">Namespace</label>
                                                <input
                                                    type="text"
                                                    className="input font-mono text-sm"
                                                    placeholder={packageData?.output_namespace || 'http://example.com/schema'}
                                                    value={config.xml?.namespace || ''}
                                                    onChange={e => updateConfig('xml.namespace', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label">Schema Location (XSD)</label>
                                                <input
                                                    type="text"
                                                    className="input font-mono text-sm"
                                                    placeholder="http://example.com/schema.xsd"
                                                    value={config.xml?.schema_location || ''}
                                                    onChange={e => updateConfig('xml.schema_location', e.target.value)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.xml?.include_declaration !== false}
                                                        onChange={e => updateConfig('xml.include_declaration', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">XML declaration</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.xml?.pretty_print || false}
                                                        onChange={e => updateConfig('xml.pretty_print', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Pretty print</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.xml?.include_timestamp !== false}
                                                        onChange={e => updateConfig('xml.include_timestamp', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Timestamp</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.xml?.include_record_count !== false}
                                                        onChange={e => updateConfig('xml.include_record_count', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Record count</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.xml?.validate_xsd || false}
                                                        onChange={e => updateConfig('xml.validate_xsd', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Validate against XSD</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.xml?.escape_special_chars !== false}
                                                        onChange={e => updateConfig('xml.escape_special_chars', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Escape special chars</span>
                                                </label>
                                            </div>

                                            {/* CDATA Fields */}
                                            <div className="pt-2 border-t">
                                                <label className="input-label">CDATA Wrapped Fields</label>
                                                <p className="text-xs text-gray-500 mb-2">Select fields to wrap in CDATA sections (preserves special characters)</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {(config.fields || []).map((field: any) => {
                                                        const isCdata = (config.xml?.cdata_fields || []).includes(field.name);
                                                        return (
                                                            <button
                                                                key={field.name}
                                                                onClick={() => {
                                                                    const current = config.xml?.cdata_fields || [];
                                                                    const updated = isCdata
                                                                        ? current.filter((f: string) => f !== field.name)
                                                                        : [...current, field.name];
                                                                    updateConfig('xml.cdata_fields', updated);
                                                                }}
                                                                className={`px-2 py-1 text-xs rounded border ${
                                                                    isCdata
                                                                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                                }`}
                                                            >
                                                                {field.name}
                                                            </button>
                                                        );
                                                    })}
                                                    {(config.fields || []).length === 0 && (
                                                        <span className="text-xs text-gray-400 italic">No fields configured in mappings</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentFormat === 'csv' && (
                                    <div className="card p-6">
                                        <h3 className="text-lg font-medium text-gray-900 mb-4">CSV Settings</h3>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="input-label">Delimiter</label>
                                                    <select
                                                        className="input"
                                                        value={config.csv?.delimiter || ','}
                                                        onChange={e => updateConfig('csv.delimiter', e.target.value)}
                                                    >
                                                        {CSV_DELIMITERS.map(d => (
                                                            <option key={d.value} value={d.value}>{d.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="input-label">Quote Char</label>
                                                    <select
                                                        className="input"
                                                        value={config.csv?.quote_char || '"'}
                                                        onChange={e => updateConfig('csv.quote_char', e.target.value)}
                                                    >
                                                        <option value='"'>" Double</option>
                                                        <option value="'">' Single</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="input-label">Line Ending</label>
                                                    <select
                                                        className="input"
                                                        value={config.csv?.line_ending || 'CRLF'}
                                                        onChange={e => updateConfig('csv.line_ending', e.target.value)}
                                                    >
                                                        {LINE_ENDINGS.map(l => (
                                                            <option key={l.value} value={l.value}>{l.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="input-label">Encoding</label>
                                                <select
                                                    className="input"
                                                    value={config.csv?.encoding || 'UTF-8'}
                                                    onChange={e => updateConfig('csv.encoding', e.target.value)}
                                                >
                                                    {XML_ENCODINGS.map(enc => (
                                                        <option key={enc.value} value={enc.value}>{enc.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.csv?.include_header !== false}
                                                        onChange={e => updateConfig('csv.include_header', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Header row</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.csv?.quote_all || false}
                                                        onChange={e => updateConfig('csv.quote_all', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Quote all fields</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.csv?.include_bom || false}
                                                        onChange={e => updateConfig('csv.include_bom', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Include BOM</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.csv?.escape_formulas || false}
                                                        onChange={e => updateConfig('csv.escape_formulas', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Escape formulas</span>
                                                </label>
                                            </div>

                                            {/* Custom Header Text */}
                                            {config.csv?.include_header !== false && (
                                                <div className="pt-2 border-t">
                                                    <label className="input-label">Custom Header Text (optional)</label>
                                                    <p className="text-xs text-gray-500 mb-2">Override default column names. Leave empty to use field names.</p>
                                                    <input
                                                        type="text"
                                                        className="input font-mono text-sm"
                                                        placeholder="Column1,Column2,Column3..."
                                                        value={config.csv?.custom_header || ''}
                                                        onChange={e => updateConfig('csv.custom_header', e.target.value)}
                                                    />
                                                </div>
                                            )}

                                            {/* Trailer Row */}
                                            <div className="pt-2 border-t">
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="input-label mb-0">Trailer Row</label>
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={config.csv?.include_trailer || false}
                                                            onChange={e => updateConfig('csv.include_trailer', e.target.checked)}
                                                        />
                                                        <span className="text-sm text-gray-700">Include</span>
                                                    </label>
                                                </div>
                                                {config.csv?.include_trailer && (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={config.csv?.trailer_record_count !== false}
                                                                    onChange={e => updateConfig('csv.trailer_record_count', e.target.checked)}
                                                                />
                                                                <span className="text-sm text-gray-700">Record count</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={config.csv?.trailer_timestamp || false}
                                                                    onChange={e => updateConfig('csv.trailer_timestamp', e.target.checked)}
                                                                />
                                                                <span className="text-sm text-gray-700">Timestamp</span>
                                                            </label>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-gray-500">Custom trailer text</label>
                                                            <input
                                                                type="text"
                                                                className="input font-mono text-sm"
                                                                placeholder="END,{record_count},{timestamp}"
                                                                value={config.csv?.trailer_text || ''}
                                                                onChange={e => updateConfig('csv.trailer_text', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentFormat === 'json' && (
                                    <div className="card p-6">
                                        <h3 className="text-lg font-medium text-gray-900 mb-4">JSON Settings</h3>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.json?.pretty_print || false}
                                                        onChange={e => updateConfig('json.pretty_print', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Pretty print</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.json?.wrap_in_array !== false}
                                                        onChange={e => updateConfig('json.wrap_in_array', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Wrap in object</span>
                                                </label>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.json?.include_metadata || false}
                                                        onChange={e => updateConfig('json.include_metadata', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Include metadata</span>
                                                </label>
                                            </div>
                                            <div>
                                                <label className="input-label">Null Handling</label>
                                                <select
                                                    className="input"
                                                    value={config.json?.null_handling || 'include'}
                                                    onChange={e => updateConfig('json.null_handling', e.target.value)}
                                                >
                                                    <option value="include">Include null values</option>
                                                    <option value="omit">Omit null fields</option>
                                                    <option value="empty_string">Convert to empty string</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Filename Configuration */}
                                <div className="card p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-medium text-gray-900">Filename</h3>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Default for all destinations</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="input-label">Pattern</label>
                                            <input
                                                type="text"
                                                className="input font-mono"
                                                placeholder="{report_name}_{date}.{ext}"
                                                value={config.filename?.pattern || '{report_name}_{date}.{ext}'}
                                                onChange={e => updateConfig('filename.pattern', e.target.value)}
                                            />
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {FILENAME_TOKENS.map(t => (
                                                    <button
                                                        key={t.token}
                                                        onClick={() => {
                                                            const current = config.filename?.pattern || '';
                                                            updateConfig('filename.pattern', current + t.token);
                                                        }}
                                                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded font-mono"
                                                        title={t.description}
                                                    >
                                                        {t.token}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="input-label">Date Format</label>
                                            <select
                                                className="input"
                                                value={config.filename?.date_format || 'YYYYMMDD'}
                                                onChange={e => updateConfig('filename.date_format', e.target.value)}
                                            >
                                                {DATE_FORMATS.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label} ({f.example})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Split & Batch Options */}
                                <div className="card p-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Split & Batch</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="input-label">Split Mode</label>
                                            <div className="space-y-2">
                                                {SPLIT_MODES.map(mode => (
                                                    <label
                                                        key={mode.value}
                                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                            (config.split?.mode || 'none') === mode.value
                                                                ? 'border-indigo-300 bg-indigo-50'
                                                                : 'border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="split_mode"
                                                            value={mode.value}
                                                            checked={(config.split?.mode || 'none') === mode.value}
                                                            onChange={e => updateConfig('split.mode', e.target.value)}
                                                            className="mt-0.5"
                                                        />
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-900">{mode.label}</span>
                                                            <p className="text-xs text-gray-500">{mode.description}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Split by Record Count Options */}
                                        {config.split?.mode === 'records' && (
                                            <div className="pl-4 border-l-2 border-indigo-200 space-y-3">
                                                <div>
                                                    <label className="input-label">Records per File</label>
                                                    <input
                                                        type="number"
                                                        className="input"
                                                        placeholder="10000"
                                                        min="100"
                                                        max="1000000"
                                                        value={config.split?.records_per_file || 10000}
                                                        onChange={e => updateConfig('split.records_per_file', parseInt(e.target.value) || 10000)}
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Split file when this limit is exceeded</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Split by Field Value Options */}
                                        {config.split?.mode === 'field' && (
                                            <div className="pl-4 border-l-2 border-indigo-200 space-y-3">
                                                <div>
                                                    <label className="input-label">Split by Field</label>
                                                    <select
                                                        className="input"
                                                        value={config.split?.field || ''}
                                                        onChange={e => updateConfig('split.field', e.target.value)}
                                                    >
                                                        <option value="">Select field...</option>
                                                        {(config.fields || []).map((field: any) => (
                                                            <option key={field.name} value={field.name}>{field.name}</option>
                                                        ))}
                                                    </select>
                                                    <p className="text-xs text-gray-500 mt-1">Create separate file for each unique value</p>
                                                </div>
                                                <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                                                    <input
                                                        type="checkbox"
                                                        checked={config.split?.include_field_in_filename !== false}
                                                        onChange={e => updateConfig('split.include_field_in_filename', e.target.checked)}
                                                    />
                                                    <span className="text-sm text-gray-700">Include field value in filename</span>
                                                </label>
                                            </div>
                                        )}

                                        {/* File Numbering (for record-based splitting) */}
                                        {config.split?.mode && config.split?.mode !== 'none' && (
                                            <div className="pt-3 border-t">
                                                <label className="input-label">File Numbering</label>
                                                <select
                                                    className="input"
                                                    value={config.split?.numbering || 'numeric'}
                                                    onChange={e => updateConfig('split.numbering', e.target.value)}
                                                >
                                                    {FILE_NUMBERING.map(n => (
                                                        <option key={n.value} value={n.value}>
                                                            {n.label} (e.g., report{n.example}.xml)
                                                        </option>
                                                    ))}
                                                </select>

                                                <div className="mt-3 grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-gray-500">Start Number</label>
                                                        <input
                                                            type="number"
                                                            className="input"
                                                            min="0"
                                                            value={config.split?.start_number || 1}
                                                            onChange={e => updateConfig('split.start_number', parseInt(e.target.value) || 1)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-500">Zero Padding</label>
                                                        <select
                                                            className="input"
                                                            value={config.split?.zero_padding || 3}
                                                            onChange={e => updateConfig('split.zero_padding', parseInt(e.target.value))}
                                                        >
                                                            <option value={2}>2 digits (01)</option>
                                                            <option value={3}>3 digits (001)</option>
                                                            <option value={4}>4 digits (0001)</option>
                                                            <option value={5}>5 digits (00001)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Preview of split filenames */}
                                                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                                    <p className="text-xs text-gray-500 mb-2">Example filenames:</p>
                                                    <div className="font-mono text-xs text-gray-700 space-y-1">
                                                        {(() => {
                                                            const pattern = config.filename?.pattern || '{report_name}_{date}.{ext}';
                                                            const ext = currentFormat;
                                                            const padding = config.split?.zero_padding || 3;
                                                            const start = config.split?.start_number || 1;
                                                            const base = pattern
                                                                .replace('{report_name}', report?.name || 'report')
                                                                .replace('{date}', '20260130')
                                                                .replace('{ext}', ext);

                                                            if (config.split?.mode === 'field') {
                                                                const fieldName = config.split?.field || 'entity';
                                                                return (
                                                                    <>
                                                                        <div>{base.replace(`.${ext}`, `_${fieldName}A.${ext}`)}</div>
                                                                        <div>{base.replace(`.${ext}`, `_${fieldName}B.${ext}`)}</div>
                                                                        <div className="text-gray-400">...</div>
                                                                    </>
                                                                );
                                                            }

                                                            const num1 = String(start).padStart(padding, '0');
                                                            const num2 = String(start + 1).padStart(padding, '0');
                                                            const num3 = String(start + 2).padStart(padding, '0');
                                                            return (
                                                                <>
                                                                    <div>{base.replace(`.${ext}`, `_${num1}.${ext}`)}</div>
                                                                    <div>{base.replace(`.${ext}`, `_${num2}.${ext}`)}</div>
                                                                    <div>{base.replace(`.${ext}`, `_${num3}.${ext}`)}</div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Live Preview (3/5 width) */}
                            <div className="col-span-3 self-start">
                                <div className="sticky top-20 space-y-4">
                                <div className="card p-6 bg-gray-900 text-gray-100">
                                    {/* Terminal header with window controls */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1.5">
                                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                            </div>
                                            <span className="text-sm text-gray-400 ml-2 font-mono">{filenamePreview}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 uppercase">{currentFormat}</span>
                                    </div>

                                    {/* Preview toolbar */}
                                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-700">
                                        <div className="flex items-center gap-2">
                                            {/* Toggle minified preview override */}
                                            <button
                                                onClick={() => setPreviewMinified(!previewMinified)}
                                                className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 transition-colors ${
                                                    previewMinified
                                                        ? 'bg-amber-600 text-white'
                                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                }`}
                                                title={previewMinified ? 'Click to show with config settings' : 'Click to preview minified output'}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {previewMinified ? (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                                    ) : (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                                                    )}
                                                </svg>
                                                {previewMinified ? 'Minified (preview)' : 'View Minified'}
                                            </button>

                                            {/* Test with real data toggle */}
                                            <button
                                                onClick={async () => {
                                                    if (!previewWithRealData && realDataSample.length === 0) {
                                                        setRealDataLoading(true);
                                                        try {
                                                            // Fetch sample data from connector
                                                            const response = await api.get(`/reports/${id}/sample-data?limit=3`);
                                                            setRealDataSample(response.data.records || []);
                                                        } catch (err) {
                                                            console.error('Failed to fetch sample data:', err);
                                                            // Use mock data as fallback
                                                            setRealDataSample([
                                                                { id: 'TXN001', amount: 15000.50, currency: 'EUR', counterparty: 'ACME Corp', trade_date: '2024-01-15' },
                                                                { id: 'TXN002', amount: 8750.00, currency: 'USD', counterparty: 'Global Ltd', trade_date: '2024-01-15' },
                                                            ]);
                                                        }
                                                        setRealDataLoading(false);
                                                    }
                                                    setPreviewWithRealData(!previewWithRealData);
                                                }}
                                                disabled={realDataLoading}
                                                className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 transition-colors ${
                                                    previewWithRealData
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                }`}
                                                title="Preview with sample data from connector"
                                            >
                                                {realDataLoading ? (
                                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                                    </svg>
                                                )}
                                                {previewWithRealData ? 'Real Data' : 'Sample Data'}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Copy to clipboard */}
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatePreview());
                                                    setPreviewCopied(true);
                                                    setTimeout(() => setPreviewCopied(false), 2000);
                                                }}
                                                className="px-3 py-1.5 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
                                                title="Copy to clipboard"
                                            >
                                                {previewCopied ? (
                                                    <>
                                                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                        Copy
                                                    </>
                                                )}
                                            </button>

                                            {/* Download preview */}
                                            <button
                                                onClick={() => {
                                                    const content = generatePreview();
                                                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = filenamePreview;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                    URL.revokeObjectURL(url);
                                                }}
                                                className="px-3 py-1.5 text-xs rounded bg-gray-800 text-gray-400 hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
                                                title="Download preview file"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                Download
                                            </button>
                                        </div>
                                    </div>

                                    <pre className="text-sm font-mono overflow-x-auto min-h-[400px] max-h-[calc(100vh-350px)] overflow-y-auto text-gray-300 leading-relaxed whitespace-pre">
                                        {generatePreview()}
                                    </pre>
                                </div>

                                {/* Output Summary */}
                                <div className="card p-4">
                                    <h4 className="font-medium text-gray-900 mb-3">Output Summary</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Format</span>
                                            <span className="font-medium">{currentFormat.toUpperCase()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Fields</span>
                                            <span className="font-medium">{(config.fields || []).length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Encoding</span>
                                            <span className="font-medium">
                                                {currentFormat === 'xml' ? config.xml?.encoding || 'UTF-8' :
                                                 currentFormat === 'csv' ? config.csv?.encoding || 'UTF-8' : 'UTF-8'}
                                            </span>
                                        </div>
                                        {currentFormat === 'xml' && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Root Element</span>
                                                    <span className="font-mono text-xs">{rootElement}</span>
                                                </div>
                                                {namespace && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Namespace</span>
                                                        <span className="font-mono text-xs truncate max-w-[200px]" title={namespace}>{namespace}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {currentFormat === 'csv' && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Delimiter</span>
                                                    <span className="font-medium">
                                                        {config.csv?.delimiter === ',' ? 'Comma' :
                                                         config.csv?.delimiter === ';' ? 'Semicolon' :
                                                         config.csv?.delimiter === '\t' ? 'Tab' :
                                                         config.csv?.delimiter === '|' ? 'Pipe' : config.csv?.delimiter || 'Comma'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Line Ending</span>
                                                    <span className="font-medium">{config.csv?.line_ending || 'CRLF'}</span>
                                                </div>
                                                {config.csv?.include_bom && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">BOM</span>
                                                        <span className="font-medium text-green-600">Included</span>
                                                    </div>
                                                )}
                                                {config.csv?.include_trailer && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Trailer</span>
                                                        <span className="font-medium text-green-600">Enabled</span>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Split Info */}
                                        {config.split?.mode && config.split.mode !== 'none' && (
                                            <div className="pt-2 mt-2 border-t">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Split Mode</span>
                                                    <span className="font-medium">
                                                        {config.split.mode === 'records' ? 'By Record Count' : 'By Field Value'}
                                                    </span>
                                                </div>
                                                {config.split.mode === 'records' && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Records/File</span>
                                                        <span className="font-medium">{(config.split.records_per_file || 10000).toLocaleString()}</span>
                                                    </div>
                                                )}
                                                {config.split.mode === 'field' && config.split.field && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Split Field</span>
                                                        <span className="font-mono text-xs">{config.split.field}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Delivery Tab */}
                {activeTab === 'delivery' && (() => {
                    // Get enabled destinations for this report
                    const enabledDestinations = config.delivery?.destinations || [];
                    const schedule = config.schedule || {};

                    // Toggle a destination
                    const toggleDestination = (destId: string) => {
                        const current = config.delivery?.destinations || [];
                        const newDests = current.some((d: any) => d.id === destId)
                            ? current.filter((d: any) => d.id !== destId)
                            : [...current, { id: destId, enabled: true, filename_pattern: '{report_name}_{date}', use_default_schedule: true }];
                        updateConfig('delivery.destinations', newDests);
                    };

                    // Update destination-specific settings
                    const updateDestinationSetting = (destId: string, key: string, value: any) => {
                        const current = config.delivery?.destinations || [];
                        const updated = current.map((d: any) =>
                            d.id === destId ? { ...d, [key]: value } : d
                        );
                        updateConfig('delivery.destinations', updated);
                    };

                    // Update destination schedule
                    const updateDestinationSchedule = (destId: string, scheduleKey: string, value: any) => {
                        const current = config.delivery?.destinations || [];
                        const updated = current.map((d: any) => {
                            if (d.id === destId) {
                                return {
                                    ...d,
                                    custom_schedule: {
                                        ...(d.custom_schedule || {}),
                                        [scheduleKey]: value
                                    }
                                };
                            }
                            return d;
                        });
                        updateConfig('delivery.destinations', updated);
                    };

                    // Check if destination is enabled
                    const isDestEnabled = (destId: string) => {
                        return enabledDestinations.some((d: any) => d.id === destId);
                    };

                    // Get destination settings
                    const getDestSettings = (destId: string) => {
                        return enabledDestinations.find((d: any) => d.id === destId) || {};
                    };

                    // Toggle week day for calendar schedule
                    const toggleScheduleDay = (day: string, isDefault: boolean = true, destId?: string) => {
                        if (isDefault) {
                            const currentDays = schedule.calendar?.days || [];
                            const newDays = currentDays.includes(day)
                                ? currentDays.filter((d: string) => d !== day)
                                : [...currentDays, day];
                            updateConfig('schedule.calendar.days', newDays);
                        } else if (destId) {
                            const settings = getDestSettings(destId);
                            const currentDays = settings.custom_schedule?.calendar?.days || [];
                            const newDays = currentDays.includes(day)
                                ? currentDays.filter((d: string) => d !== day)
                                : [...currentDays, day];
                            updateDestinationSchedule(destId, 'calendar', { ...(settings.custom_schedule?.calendar || {}), days: newDays });
                        }
                    };

                    return (
                        <div className="space-y-6">
                            {/* Default Schedule Configuration */}
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">Default Schedule</h3>
                                        <p className="text-sm text-gray-500">Configure when this report runs (can be overridden per destination)</p>
                                    </div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={schedule.enabled !== false}
                                            onChange={e => updateConfig('schedule.enabled', e.target.checked)}
                                        />
                                        <span className="text-sm text-gray-600">Enable scheduling</span>
                                    </label>
                                </div>

                                {schedule.enabled !== false && (
                                    <div className="space-y-6 border-t pt-4">
                                        {/* Schedule Type */}
                                        <div>
                                            <label className="input-label">Schedule Type</label>
                                            <div className="flex gap-4 mt-2">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="schedule-type"
                                                        checked={schedule.type === 'cron' || !schedule.type}
                                                        onChange={() => updateConfig('schedule.type', 'cron')}
                                                    />
                                                    <span className="text-sm text-gray-700">Cron Expression</span>
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="schedule-type"
                                                        checked={schedule.type === 'calendar'}
                                                        onChange={() => updateConfig('schedule.type', 'calendar')}
                                                    />
                                                    <span className="text-sm text-gray-700">Calendar</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Cron Schedule */}
                                        {(schedule.type === 'cron' || !schedule.type) && (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="input-label">Quick Presets</label>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {CRON_PRESETS.map(preset => (
                                                            <button
                                                                key={preset.value}
                                                                type="button"
                                                                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                                                    schedule.cron === preset.value
                                                                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                                }`}
                                                                onClick={() => updateConfig('schedule.cron', preset.value)}
                                                                title={preset.description}
                                                            >
                                                                {preset.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="input-label">Cron Expression</label>
                                                    <input
                                                        type="text"
                                                        className="input max-w-md font-mono"
                                                        placeholder="0 6 * * *"
                                                        value={schedule.cron || ''}
                                                        onChange={e => updateConfig('schedule.cron', e.target.value)}
                                                    />
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Format: minute hour day-of-month month day-of-week
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Calendar Schedule */}
                                        {schedule.type === 'calendar' && (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="input-label">Frequency</label>
                                                    <select
                                                        className="input max-w-xs"
                                                        value={schedule.calendar?.frequency || 'weekly'}
                                                        onChange={e => updateConfig('schedule.calendar.frequency', e.target.value)}
                                                    >
                                                        <option value="daily">Daily</option>
                                                        <option value="weekly">Weekly</option>
                                                        <option value="monthly">Monthly</option>
                                                        <option value="quarterly">Quarterly</option>
                                                        <option value="yearly">Yearly</option>
                                                    </select>
                                                </div>

                                                {/* Weekly: Day selection */}
                                                {schedule.calendar?.frequency === 'weekly' && (
                                                    <div>
                                                        <label className="input-label">Run on Days</label>
                                                        <div className="flex gap-2 mt-2">
                                                            {WEEK_DAYS.map(day => (
                                                                <button
                                                                    key={day}
                                                                    type="button"
                                                                    className={`w-10 h-10 rounded-lg text-sm font-medium border transition-colors ${
                                                                        (schedule.calendar?.days || []).includes(day)
                                                                            ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                                    }`}
                                                                    onClick={() => toggleScheduleDay(day)}
                                                                >
                                                                    {day}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Monthly: Day of month */}
                                                {schedule.calendar?.frequency === 'monthly' && (
                                                    <div>
                                                        <label className="input-label">Day of Month</label>
                                                        <select
                                                            className="input max-w-xs"
                                                            value={schedule.calendar?.day_of_month || 1}
                                                            onChange={e => updateConfig('schedule.calendar.day_of_month', parseInt(e.target.value))}
                                                        >
                                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                                <option key={day} value={day}>{day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}</option>
                                                            ))}
                                                            <option value={-1}>Last day of month</option>
                                                        </select>
                                                    </div>
                                                )}

                                                {/* Time slots */}
                                                <div>
                                                    <label className="input-label">Run at Time(s)</label>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {(schedule.calendar?.times || ['06:00']).map((time: string, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-1">
                                                                <input
                                                                    type="time"
                                                                    className="input input-sm w-28"
                                                                    value={time}
                                                                    onChange={e => {
                                                                        const times = [...(schedule.calendar?.times || ['06:00'])];
                                                                        times[idx] = e.target.value;
                                                                        updateConfig('schedule.calendar.times', times);
                                                                    }}
                                                                />
                                                                {(schedule.calendar?.times || []).length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        className="text-red-500 hover:text-red-700 p-1"
                                                                        onClick={() => {
                                                                            const times = (schedule.calendar?.times || []).filter((_: string, i: number) => i !== idx);
                                                                            updateConfig('schedule.calendar.times', times);
                                                                        }}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => {
                                                                const times = [...(schedule.calendar?.times || ['06:00']), '12:00'];
                                                                updateConfig('schedule.calendar.times', times);
                                                            }}
                                                        >
                                                            + Add Time
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Timezone */}
                                        <div>
                                            <label className="input-label">Timezone</label>
                                            <select
                                                className="input max-w-md"
                                                value={schedule.timezone || 'UTC'}
                                                onChange={e => updateConfig('schedule.timezone', e.target.value)}
                                            >
                                                {TIMEZONES.map(tz => (
                                                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Blackout Dates */}
                                        <div>
                                            <label className="input-label">Blackout Dates</label>
                                            <p className="text-xs text-gray-500 mb-2">Dates when the report should not run (holidays, maintenance windows)</p>
                                            <div className="flex flex-wrap gap-2">
                                                {(schedule.blackout_dates || []).map((date: string, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-1 bg-red-50 border border-red-200 rounded px-2 py-1">
                                                        <span className="text-sm text-red-700">{date}</span>
                                                        <button
                                                            type="button"
                                                            className="text-red-500 hover:text-red-700"
                                                            onClick={() => {
                                                                const dates = (schedule.blackout_dates || []).filter((_: string, i: number) => i !== idx);
                                                                updateConfig('schedule.blackout_dates', dates);
                                                            }}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                                <input
                                                    type="date"
                                                    className="input input-sm w-36"
                                                    onChange={e => {
                                                        if (e.target.value) {
                                                            const dates = [...(schedule.blackout_dates || []), e.target.value];
                                                            updateConfig('schedule.blackout_dates', dates);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Retry on Failure */}
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={schedule.retry_on_failure !== false}
                                                    onChange={e => updateConfig('schedule.retry_on_failure', e.target.checked)}
                                                />
                                                <span className="text-sm text-gray-700">Retry on failure</span>
                                            </label>
                                            {schedule.retry_on_failure !== false && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-500">Max retries:</span>
                                                    <input
                                                        type="number"
                                                        className="input input-sm w-16"
                                                        min="1"
                                                        max="10"
                                                        value={schedule.max_retries || 3}
                                                        onChange={e => updateConfig('schedule.max_retries', parseInt(e.target.value))}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Delivery Destinations with individual schedules */}
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">Delivery Destinations</h3>
                                        <p className="text-sm text-gray-500">Select destinations and configure individual delivery schedules</p>
                                    </div>
                                    <Link to="/destinations" className="text-sm text-indigo-600 hover:text-indigo-700">
                                        Manage Destinations
                                    </Link>
                                </div>

                                {/* Destinations list */}
                                {destinationsLibrary && destinationsLibrary.length > 0 ? (
                                    <div className="space-y-3">
                                        {destinationsLibrary.map((dest: any) => {
                                            const isEnabled = isDestEnabled(dest.id);
                                            const settings = getDestSettings(dest.id);
                                            const useDefaultSchedule = settings.use_default_schedule !== false;
                                            const destSchedule = settings.custom_schedule || {};

                                            return (
                                                <div
                                                    key={dest.id}
                                                    className={`border rounded-lg p-4 ${isEnabled ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-200'}`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isEnabled}
                                                            onChange={() => toggleDestination(dest.id)}
                                                            className="mt-1"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg">
                                                                    {dest.protocol === 'sftp' ? '🔒' : dest.protocol === 's3' ? '☁️' : dest.protocol === 'email' ? '📧' : dest.protocol === 'api' ? '🔗' : '📁'}
                                                                </span>
                                                                <span className="font-medium text-gray-900">{dest.name}</span>
                                                                <span className="badge badge-gray text-xs">{dest.protocol?.toUpperCase()}</span>
                                                                {dest.is_active ? (
                                                                    <span className="badge badge-success text-xs">Active</span>
                                                                ) : (
                                                                    <span className="badge badge-warning text-xs">Inactive</span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-gray-500 mt-1">
                                                                {dest.protocol === 'email' && dest.email_to && (
                                                                    <span>To: {dest.email_to}</span>
                                                                )}
                                                                {dest.host && <span>{dest.host}{dest.port ? `:${dest.port}` : ''}</span>}
                                                                {dest.directory && <span className="ml-2 font-mono text-xs">{dest.directory}</span>}
                                                            </div>

                                                            {/* Per-destination settings when enabled */}
                                                            {isEnabled && (
                                                                <div className="mt-3 pt-3 border-t border-indigo-100 space-y-4">
                                                                    {/* File settings */}
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="text-xs text-gray-500">Filename Pattern</label>
                                                                            <input
                                                                                type="text"
                                                                                className="input input-sm text-sm mt-1"
                                                                                placeholder={config.filename?.pattern || '{report_name}_{date}.{ext}'}
                                                                                value={settings.filename_pattern || ''}
                                                                                onChange={e => updateDestinationSetting(dest.id, 'filename_pattern', e.target.value)}
                                                                            />
                                                                            <p className="text-xs text-gray-400 mt-1 flex items-center justify-between">
                                                                                {settings.filename_pattern ? (
                                                                                    <>
                                                                                        <span className="text-indigo-500">Custom pattern</span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => updateDestinationSetting(dest.id, 'filename_pattern', '')}
                                                                                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                                                                                        >
                                                                                            Reset to default
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <span>Using report default</span>
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs text-gray-500">Subdirectory</label>
                                                                            <input
                                                                                type="text"
                                                                                className="input input-sm text-sm mt-1"
                                                                                placeholder="/{year}/{month}/"
                                                                                value={settings.subdirectory || ''}
                                                                                onChange={e => updateDestinationSetting(dest.id, 'subdirectory', e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Email-specific settings */}
                                                                    {dest.protocol === 'email' && (
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <div>
                                                                                <label className="text-xs text-gray-500">Email Subject</label>
                                                                                <input
                                                                                    type="text"
                                                                                    className="input input-sm text-sm mt-1"
                                                                                    placeholder="{report_name} - {date}"
                                                                                    value={settings.email_subject || ''}
                                                                                    onChange={e => updateDestinationSetting(dest.id, 'email_subject', e.target.value)}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-xs text-gray-500">CC Recipients</label>
                                                                                <input
                                                                                    type="text"
                                                                                    className="input input-sm text-sm mt-1"
                                                                                    placeholder="compliance@company.com"
                                                                                    value={settings.email_cc || ''}
                                                                                    onChange={e => updateDestinationSetting(dest.id, 'email_cc', e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Schedule override */}
                                                                    <div className="bg-white border border-indigo-100 rounded-lg p-3">
                                                                        <div className="flex items-center justify-between">
                                                                            <label className="text-xs font-medium text-gray-700">Delivery Schedule</label>
                                                                            <label className="flex items-center gap-2">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={useDefaultSchedule}
                                                                                    onChange={e => updateDestinationSetting(dest.id, 'use_default_schedule', e.target.checked)}
                                                                                />
                                                                                <span className="text-xs text-gray-600">Use default schedule</span>
                                                                            </label>
                                                                        </div>

                                                                        {useDefaultSchedule ? (
                                                                            <p className="text-xs text-gray-500 mt-2">
                                                                                Uses the default schedule configured above
                                                                                {schedule.enabled !== false && schedule.cron && (
                                                                                    <span className="ml-1 font-mono text-indigo-600">({schedule.cron})</span>
                                                                                )}
                                                                            </p>
                                                                        ) : (
                                                                            <div className="mt-3 space-y-3">
                                                                                {/* Custom cron for this destination */}
                                                                                <div>
                                                                                    <label className="text-xs text-gray-500">Custom Cron Expression</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        className="input input-sm text-sm font-mono mt-1"
                                                                                        placeholder="0 8 * * 1-5"
                                                                                        value={destSchedule.cron || ''}
                                                                                        onChange={e => updateDestinationSchedule(dest.id, 'cron', e.target.value)}
                                                                                    />
                                                                                </div>
                                                                                {/* Quick presets */}
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {CRON_PRESETS.slice(0, 4).map(preset => (
                                                                                        <button
                                                                                            key={preset.value}
                                                                                            type="button"
                                                                                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                                                                                                destSchedule.cron === preset.value
                                                                                                    ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                                                                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                                                            }`}
                                                                                            onClick={() => updateDestinationSchedule(dest.id, 'cron', preset.value)}
                                                                                        >
                                                                                            {preset.label}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                                {/* Delay option */}
                                                                                <div className="flex items-center gap-2">
                                                                                    <label className="text-xs text-gray-500">Delay after generation:</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        className="input input-sm w-16"
                                                                                        min="0"
                                                                                        value={destSchedule.delay_minutes || 0}
                                                                                        onChange={e => updateDestinationSchedule(dest.id, 'delay_minutes', parseInt(e.target.value))}
                                                                                    />
                                                                                    <span className="text-xs text-gray-500">minutes</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        <p>No destinations configured</p>
                                        <Link to="/destinations" className="text-indigo-600 hover:underline text-sm mt-1 inline-block">
                                            Create your first destination
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Archive Configuration */}
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">Archive Storage</h3>
                                        <p className="text-sm text-gray-500">Where generated reports are stored (S3/MinIO compatible)</p>
                                    </div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={config.archive?.enabled !== false}
                                            onChange={e => updateConfig('archive.enabled', e.target.checked)}
                                        />
                                        <span className="text-sm text-gray-600">Enable archiving</span>
                                    </label>
                                </div>

                                {config.archive?.enabled !== false && (
                                    <div className="space-y-4 border-t pt-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="input-label">Endpoint URL</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="http://minio:9000 or https://s3.amazonaws.com"
                                                    value={config.archive?.endpoint || ''}
                                                    onChange={e => updateConfig('archive.endpoint', e.target.value)}
                                                />
                                                <p className="text-xs text-gray-400 mt-1">MinIO or S3-compatible endpoint</p>
                                            </div>
                                            <div>
                                                <label className="input-label">Bucket Name</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="report-archives"
                                                    value={config.archive?.bucket || ''}
                                                    onChange={e => updateConfig('archive.bucket', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="input-label">Path Prefix</label>
                                            <input
                                                type="text"
                                                className="input"
                                                placeholder="reports/{regulation}/{year}/{month}/"
                                                value={config.archive?.path_prefix || ''}
                                                onChange={e => updateConfig('archive.path_prefix', e.target.value)}
                                            />
                                            <p className="text-xs text-gray-400 mt-1">
                                                Variables: {'{regulation}'}, {'{report_name}'}, {'{year}'}, {'{month}'}, {'{day}'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="input-label">Access Key</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="AKIAIOSFODNN7EXAMPLE"
                                                    value={config.archive?.access_key || ''}
                                                    onChange={e => updateConfig('archive.access_key', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label">Secret Key</label>
                                                <input
                                                    type="password"
                                                    className="input"
                                                    placeholder="••••••••••••"
                                                    value={config.archive?.secret_key || ''}
                                                    onChange={e => updateConfig('archive.secret_key', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="input-label">Retention Period</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        className="input w-24"
                                                        min="1"
                                                        value={config.archive?.retention_value || 90}
                                                        onChange={e => updateConfig('archive.retention_value', parseInt(e.target.value))}
                                                    />
                                                    <select
                                                        className="input flex-1"
                                                        value={config.archive?.retention_unit || 'days'}
                                                        onChange={e => updateConfig('archive.retention_unit', e.target.value)}
                                                    >
                                                        <option value="days">Days</option>
                                                        <option value="months">Months</option>
                                                        <option value="years">Years</option>
                                                        <option value="forever">Forever (no expiry)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="input-label">Region (optional)</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="eu-west-1"
                                                    value={config.archive?.region || ''}
                                                    onChange={e => updateConfig('archive.region', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* API Webhook (inline option) */}
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900">API Webhook</h3>
                                        <p className="text-sm text-gray-500">Notify external systems when reports are generated</p>
                                    </div>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={config.webhook?.enabled || false}
                                            onChange={e => updateConfig('webhook.enabled', e.target.checked)}
                                        />
                                        <span className="text-sm text-gray-600">Enable webhook</span>
                                    </label>
                                </div>

                                {config.webhook?.enabled && (
                                    <div className="space-y-4 border-t pt-4">
                                        <div>
                                            <label className="input-label">Webhook URL</label>
                                            <input
                                                type="url"
                                                className="input"
                                                placeholder="https://your-system.com/api/webhook/reports"
                                                value={config.webhook?.url || ''}
                                                onChange={e => updateConfig('webhook.url', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="input-label">Authorization Header</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Bearer your-token"
                                                    value={config.webhook?.auth_header || ''}
                                                    onChange={e => updateConfig('webhook.auth_header', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="input-label">HTTP Method</label>
                                                <select
                                                    className="input"
                                                    value={config.webhook?.method || 'POST'}
                                                    onChange={e => updateConfig('webhook.method', e.target.value)}
                                                >
                                                    <option value="POST">POST</option>
                                                    <option value="PUT">PUT</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="input-label">Custom Headers (JSON)</label>
                                            <input
                                                type="text"
                                                className="input font-mono text-sm"
                                                placeholder='{"X-Custom-Header": "value"}'
                                                value={config.webhook?.custom_headers || ''}
                                                onChange={e => updateConfig('webhook.custom_headers', e.target.value)}
                                            />
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3 text-xs">
                                            <p className="font-medium text-gray-700 mb-2">Webhook Payload Example:</p>
                                            <pre className="text-gray-600 overflow-x-auto">
{`{
  "event": "report_generated",
  "report_id": "${id}",
  "report_name": "${report?.name || 'Report Name'}",
  "generated_at": "2024-01-15T08:00:00Z",
  "file_url": "/api/reports/${id}/download",
  "format": "${config.output_format || 'xml'}"
}`}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Summary */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Schedule & Delivery Summary</h4>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p>
                                        <span className="font-medium">Schedule:</span>{' '}
                                        {schedule.enabled !== false
                                            ? schedule.type === 'calendar'
                                                ? `Calendar (${schedule.calendar?.frequency || 'weekly'})`
                                                : `Cron: ${schedule.cron || 'Not configured'}`
                                            : 'Disabled (manual only)'}
                                        {schedule.timezone && schedule.timezone !== 'UTC' && ` (${schedule.timezone})`}
                                    </p>
                                    <p>
                                        <span className="font-medium">Archive:</span>{' '}
                                        {config.archive?.enabled !== false
                                            ? `${config.archive?.bucket || 'Not configured'} (${config.archive?.retention_value || 90} ${config.archive?.retention_unit || 'days'} retention)`
                                            : 'Disabled'}
                                    </p>
                                    <p>
                                        <span className="font-medium">Destinations:</span>{' '}
                                        {enabledDestinations.length > 0
                                            ? enabledDestinations.map((d: any) => {
                                                const dest = destinationsLibrary?.find((lib: any) => lib.id === d.id);
                                                const hasCustomSchedule = d.use_default_schedule === false;
                                                return `${dest?.name || d.id}${hasCustomSchedule ? '*' : ''}`;
                                            }).join(', ')
                                            : 'None selected'}
                                        {enabledDestinations.some((d: any) => d.use_default_schedule === false) && (
                                            <span className="text-xs text-gray-400 ml-1">(* custom schedule)</span>
                                        )}
                                    </p>
                                    <p>
                                        <span className="font-medium">Webhook:</span>{' '}
                                        {config.webhook?.enabled ? config.webhook?.url || 'Not configured' : 'Disabled'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* History Tab */}
                {activeTab === 'history' && (() => {
                    const isCurrentVersion = (version: any) => {
                        return version.id === report?.current_version_id;
                    };

                    const handleViewVersion = (version: any) => {
                        setSelectedVersion(version);
                        setShowVersionDetail(true);
                    };

                    const handleRestoreVersion = async (version: any) => {
                        if (!confirm(`Restore version v${version.major_version}.${version.minor_version}? This will make it the active version.`)) {
                            return;
                        }
                        try {
                            await reportsAPI.approveVersion(id!, version.id);
                            queryClient.invalidateQueries(['report', id]);
                            queryClient.invalidateQueries(['report-versions', id]);
                            showSuccess('Version Restored', `v${version.major_version}.${version.minor_version} is now active.`);
                        } catch (err: any) {
                            showError('Restore Failed', err?.response?.data?.detail || 'Please try again.');
                        }
                    };

                    return (
                        <div className="space-y-4">
                            <div className="card overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Output Format</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {versions && versions.length > 0 ? versions.map((version: any) => (
                                            <tr key={version.id} className={`hover:bg-gray-50 ${isCurrentVersion(version) ? 'bg-indigo-50' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <span className="font-medium">v{version.major_version}.{version.minor_version}</span>
                                                    {isCurrentVersion(version) && (
                                                        <span className="ml-2 badge badge-success text-xs">Current</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`badge text-xs ${
                                                        version.status === 'active' ? 'badge-success' :
                                                        version.status === 'draft' ? 'badge-warning' :
                                                        'badge-gray'
                                                    }`}>
                                                        {version.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-sm">
                                                    {new Date(version.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-sm">
                                                    {version.config?.output_format?.toUpperCase() || 'XML'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleViewVersion(version)}
                                                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                                        >
                                                            View
                                                        </button>
                                                        {!isCurrentVersion(version) && (
                                                            <button
                                                                onClick={() => handleRestoreVersion(version)}
                                                                className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
                                                            >
                                                                Restore
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                    No version history available
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Version Detail Modal */}
                            {showVersionDetail && selectedVersion && (
                                <div className="modal-overlay" onClick={() => setShowVersionDetail(false)}>
                                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                                        <div className="modal-header">
                                            <h3 className="modal-title">
                                                Version v{selectedVersion.major_version}.{selectedVersion.minor_version}
                                            </h3>
                                            <button onClick={() => setShowVersionDetail(false)} className="btn btn-ghost btn-icon">
                                                ×
                                            </button>
                                        </div>
                                        <div className="modal-body space-y-4">
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Status:</span>
                                                    <span className="ml-2 font-medium">{selectedVersion.status}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Created:</span>
                                                    <span className="ml-2">{new Date(selectedVersion.created_at).toLocaleString()}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Output Format:</span>
                                                    <span className="ml-2 font-medium">{selectedVersion.config?.output_format?.toUpperCase() || 'XML'}</span>
                                                </div>
                                                {selectedVersion.approved_at && (
                                                    <div>
                                                        <span className="text-gray-500">Approved:</span>
                                                        <span className="ml-2">{new Date(selectedVersion.approved_at).toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Config Summary */}
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-2">Configuration</h4>
                                                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Fields Mapped:</span>
                                                        <span>{selectedVersion.config?.fields?.length || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">CDM Mappings:</span>
                                                        <span>{selectedVersion.config?.cdm_mappings?.length || 0}</span>
                                                    </div>
                                                    {selectedVersion.config?.filename && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Filename Pattern:</span>
                                                            <span className="font-mono text-xs">{selectedVersion.config.filename.template}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Python Code Preview */}
                                            {selectedVersion.python_code && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-2">Transformation Code</h4>
                                                    <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto max-h-48">
                                                        {selectedVersion.python_code}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                        <div className="modal-footer">
                                            {!isCurrentVersion(selectedVersion) && (
                                                <button
                                                    onClick={() => {
                                                        handleRestoreVersion(selectedVersion);
                                                        setShowVersionDetail(false);
                                                    }}
                                                    className="btn btn-primary"
                                                >
                                                    Restore This Version
                                                </button>
                                            )}
                                            <button onClick={() => setShowVersionDetail(false)} className="btn btn-secondary">
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
