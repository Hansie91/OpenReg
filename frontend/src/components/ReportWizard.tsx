import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { reportsAPI } from '../services/api';
import { ALL_PACKAGES, RegulationPackage, ReportTypeSpec } from '../data/regulationPackages';
import { useToast } from '../store/toastStore';

interface WizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// Icons
const Icons = {
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    ChevronRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
    ),
    ChevronLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
    ),
    Code: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
    ),
    Package: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
    ),
    Shield: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
    ),
    Document: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
    ),
    Layers: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" />
        </svg>
    ),
    ArrowRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
    ),
};

// Regulation-specific styling
const regulationStyles: Record<string, { bg: string; border: string; text: string; icon: () => JSX.Element }> = {
    EMIR: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: Icons.Shield },
    MIFIR: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', icon: Icons.Document },
    SFTR: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', icon: Icons.Layers },
};

// Output format options for Advanced Mode
const OUTPUT_FORMATS = [
    { value: 'xml', label: 'XML', description: 'Regulatory XML format' },
    { value: 'json', label: 'JSON', description: 'Structured data interchange' },
    { value: 'csv', label: 'CSV', description: 'Comma-separated values' },
];

export default function ReportWizard({ isOpen, onClose, onSuccess }: WizardProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    // Form state
    const [mode, setMode] = useState<'advanced' | 'package' | 'report-type' | null>(null);
    const [creatingPackageId, setCreatingPackageId] = useState<string | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<RegulationPackage | null>(null);
    const [selectedReportType, setSelectedReportType] = useState<string | null>(null);

    // Advanced mode state
    const [reportName, setReportName] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [pythonCode, setPythonCode] = useState('');
    const [outputFormat, setOutputFormat] = useState('xml');

    // Create report from package - automatically creates with all package config
    const createFromPackageMutation = useMutation(
        async ({ pkg, reportType }: { pkg: RegulationPackage; reportType?: string }) => {
            setCreatingPackageId(pkg.package_id);

            // Filter fields by report type if specified
            const filteredFields = reportType
                ? pkg.fields.filter(f => !f.report_types || f.report_types.includes(reportType))
                : pkg.fields;

            // Get report type info for naming
            const reportTypeInfo = reportType && pkg.report_types
                ? pkg.report_types.find(rt => rt.code === reportType)
                : null;

            // Build full report configuration from package
            const config = {
                mode: 'package',
                package_id: pkg.package_id,
                regulation: pkg.regulation_code,
                version: pkg.version,
                report_type: reportType || null,
                output_format: pkg.output_format.toLowerCase().includes('xml') ? 'xml' : 'json',
                // Include filtered fields with CDM mappings
                fields: filteredFields.map(f => ({
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
                    // Data source mapping (to be configured later)
                    source: null
                })),
                // Include all validation rules
                validation_rules: pkg.validation_rules.map(r => ({
                    rule_id: r.rule_id,
                    name: r.name,
                    description: r.description,
                    severity: r.severity,
                    rule_type: r.rule_type,
                    expression: r.expression,
                    error_message: r.error_message,
                    affected_fields: r.affected_fields,
                    enabled: true
                })),
                // Schema configuration
                schema: {
                    namespace: pkg.output_namespace,
                    root_element: pkg.output_root_element,
                    format: pkg.output_format
                },
                // Default schedule (manual)
                schedule: {
                    frequency: 'manual',
                    time: null
                },
                // Default delivery (none)
                delivery: {
                    method: 'none',
                    config: {}
                }
            };

            const reportName = reportTypeInfo
                ? `${pkg.regulation_code} ${reportTypeInfo.name}`
                : `${pkg.regulation_code} Report`;

            const reportDesc = reportTypeInfo
                ? `${pkg.regulation_name} - ${reportTypeInfo.name}. ${reportTypeInfo.description}`
                : `${pkg.regulation_name} - ${pkg.version}. ${pkg.description}`;

            return reportsAPI.create({
                name: reportName,
                description: reportDesc,
                config
            });
        },
        {
            onSuccess: (response, { pkg, reportType }) => {
                queryClient.invalidateQueries('reports');
                const reportTypeInfo = reportType && pkg.report_types
                    ? pkg.report_types.find(rt => rt.code === reportType)
                    : null;
                showSuccess(
                    'Report Created',
                    `${pkg.regulation_code}${reportTypeInfo ? ` ${reportTypeInfo.name}` : ' report'} created. You can now configure mappings and settings.`
                );
                setCreatingPackageId(null);
                setSelectedPackage(null);
                setSelectedReportType(null);
                onSuccess();
                handleClose();
                // Navigate to the report detail page to configure mappings
                if (response?.data?.id) {
                    navigate(`/reports/${response.data.id}`);
                }
            },
            onError: (error: any) => {
                showError(
                    'Failed to create report',
                    error?.response?.data?.detail || 'Please try again.'
                );
                setCreatingPackageId(null);
            }
        }
    );

    // Create advanced report
    const createAdvancedMutation = useMutation(
        async () => {
            const config = {
                mode: 'advanced',
                python_code: pythonCode,
                output_format: outputFormat
            };

            return reportsAPI.create({
                name: reportName,
                description: reportDescription,
                config
            });
        },
        {
            onSuccess: (response) => {
                queryClient.invalidateQueries('reports');
                showSuccess('Report Created', `${reportName} has been created.`);
                onSuccess();
                handleClose();
                if (response?.data?.id) {
                    navigate(`/reports/${response.data.id}`);
                }
            },
            onError: (error: any) => {
                showError('Failed to create report', error?.response?.data?.detail || 'Please try again.');
            }
        }
    );

    const resetForm = () => {
        setMode(null);
        setCreatingPackageId(null);
        setSelectedPackage(null);
        setSelectedReportType(null);
        setReportName('');
        setReportDescription('');
        setPythonCode('');
        setOutputFormat('xml');
    };

    // Handle package selection - show report type selection if available
    const handlePackageSelect = (pkg: RegulationPackage) => {
        if (pkg.report_types && pkg.report_types.length > 0) {
            setSelectedPackage(pkg);
            setMode('report-type');
        } else {
            // No report types - create directly
            createFromPackageMutation.mutate({ pkg });
        }
    };

    // Handle report type selection and create report
    const handleReportTypeSelect = (reportType: string) => {
        if (selectedPackage) {
            setSelectedReportType(reportType);
            createFromPackageMutation.mutate({ pkg: selectedPackage, reportType });
        }
    };

    // Create with all fields (no report type filter)
    const handleCreateAllFields = () => {
        if (selectedPackage) {
            createFromPackageMutation.mutate({ pkg: selectedPackage });
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Create Report</h2>
                        <p className="text-sm text-gray-500">
                            {mode === null && 'Choose how to create your report'}
                            {mode === 'package' && 'Select a regulation package'}
                            {mode === 'report-type' && selectedPackage && `Select report type for ${selectedPackage.regulation_code}`}
                            {mode === 'advanced' && 'Configure your custom report'}
                        </p>
                    </div>
                    <button onClick={handleClose} className="btn btn-ghost btn-icon">
                        <Icons.Close />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Step 1: Mode Selection */}
                    {mode === null && (
                        <div className="max-w-3xl mx-auto">
                            <h3 className="text-lg font-medium text-gray-900 mb-6 text-center">
                                Choose how you want to create your report
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <button
                                    onClick={() => setMode('package')}
                                    className="p-6 rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
                                >
                                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-indigo-100 text-indigo-600">
                                        <Icons.Package />
                                    </div>
                                    <h4 className="font-semibold text-gray-900 mb-2">Start from Package</h4>
                                    <p className="text-sm text-gray-600">
                                        Select a pre-built EMIR, MiFIR, or SFTR package. All fields, validations, and CDM mappings are configured automatically.
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="badge badge-success">Recommended</span>
                                        <span className="badge badge-info">Pre-configured</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setMode('advanced')}
                                    className="p-6 rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
                                >
                                    <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-gray-100 text-gray-600">
                                        <Icons.Code />
                                    </div>
                                    <h4 className="font-semibold text-gray-900 mb-2">Advanced Mode</h4>
                                    <p className="text-sm text-gray-600">
                                        Create a custom report with Python code for full control over transformations and output format.
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="badge badge-warning">Python</span>
                                        <span className="badge badge-gray">Custom Logic</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Package Selection - Click to create immediately */}
                    {mode === 'package' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Click a package to create your report.</strong> The report will be created with all fields, validation rules, and CDM mappings pre-configured. You can then customize everything from the report detail page.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {ALL_PACKAGES.map(pkg => {
                                    const style = regulationStyles[pkg.regulation_code] || regulationStyles.EMIR;
                                    const IconComponent = style.icon;
                                    const isCreating = creatingPackageId === pkg.package_id;

                                    return (
                                        <button
                                            key={pkg.package_id}
                                            onClick={() => handlePackageSelect(pkg)}
                                            disabled={!!creatingPackageId}
                                            className={`rounded-xl border-2 p-5 text-left transition-all hover:shadow-lg disabled:opacity-50 ${style.border} ${style.bg}`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center ${style.text}`}>
                                                        <IconComponent />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900">{pkg.regulation_code}</h4>
                                                        <p className="text-xs text-gray-500">{pkg.version}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <h5 className="font-medium text-gray-900 mb-1">{pkg.regulation_name}</h5>
                                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pkg.description}</p>

                                            <div className="grid grid-cols-3 gap-2 mb-4">
                                                <div className="text-center bg-white/60 rounded-lg py-2">
                                                    <div className="text-lg font-bold text-gray-900">{pkg.field_count}</div>
                                                    <div className="text-xs text-gray-500">Fields</div>
                                                </div>
                                                <div className="text-center bg-white/60 rounded-lg py-2">
                                                    <div className="text-lg font-bold text-red-600">{pkg.mandatory_fields}</div>
                                                    <div className="text-xs text-gray-500">Required</div>
                                                </div>
                                                <div className="text-center bg-white/60 rounded-lg py-2">
                                                    <div className="text-lg font-bold text-blue-600">{pkg.validation_rule_count}</div>
                                                    <div className="text-xs text-gray-500">Rules</div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-1 mb-4">
                                                <span className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-600">
                                                    {pkg.jurisdiction}
                                                </span>
                                                <span className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-600">
                                                    {pkg.output_format}
                                                </span>
                                                {pkg.report_types && pkg.report_types.length > 0 && (
                                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                                        {pkg.report_types.length} report types
                                                    </span>
                                                )}
                                            </div>

                                            <div className={`w-full py-2 px-4 rounded-lg text-center font-medium text-white ${style.text.replace('text-', 'bg-')}`}>
                                                {isCreating ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        Creating...
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center justify-center gap-2">
                                                        Create Report
                                                        <Icons.ArrowRight />
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Report Type Selection */}
                    {mode === 'report-type' && selectedPackage && selectedPackage.report_types && (
                        <div className="space-y-6">
                            <button
                                onClick={() => {
                                    setMode('package');
                                    setSelectedPackage(null);
                                }}
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                            >
                                <Icons.ChevronLeft />
                                <span>Back to packages</span>
                            </button>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>{selectedPackage.regulation_code}</strong> supports multiple report types.
                                    Select a report type to create a report with only the relevant fields, or choose
                                    "All Fields" to include everything.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedPackage.report_types.map((rt) => {
                                    const isCreating = creatingPackageId === selectedPackage.package_id && selectedReportType === rt.code;
                                    return (
                                        <button
                                            key={rt.code}
                                            onClick={() => handleReportTypeSelect(rt.code)}
                                            disabled={!!creatingPackageId}
                                            className="rounded-xl border-2 border-gray-200 hover:border-indigo-500 p-5 text-left transition-all hover:shadow-lg disabled:opacity-50"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                                    {rt.code}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {rt.field_count} fields
                                                </span>
                                            </div>
                                            <h4 className="font-semibold text-gray-900 mb-1">{rt.name}</h4>
                                            <p className="text-sm text-gray-600 mb-3">{rt.description}</p>
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {rt.action_types.map(action => (
                                                    <span key={action} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                                        {action}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="w-full py-2 px-4 rounded-lg text-center font-medium text-white bg-indigo-600">
                                                {isCreating ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        Creating...
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center justify-center gap-2">
                                                        Create {rt.name}
                                                        <Icons.ArrowRight />
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* All Fields Option */}
                                <button
                                    onClick={handleCreateAllFields}
                                    disabled={!!creatingPackageId}
                                    className="rounded-xl border-2 border-gray-200 hover:border-gray-400 p-5 text-left transition-all hover:shadow-lg disabled:opacity-50"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                            ALL
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {selectedPackage.field_count} fields
                                        </span>
                                    </div>
                                    <h4 className="font-semibold text-gray-900 mb-1">All Fields</h4>
                                    <p className="text-sm text-gray-600 mb-3">
                                        Include all {selectedPackage.field_count} fields regardless of report type.
                                        Use this if you need a comprehensive template.
                                    </p>
                                    <div className="w-full py-2 px-4 rounded-lg text-center font-medium text-white bg-gray-600">
                                        {creatingPackageId === selectedPackage.package_id && !selectedReportType ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Creating...
                                            </span>
                                        ) : (
                                            <span className="flex items-center justify-center gap-2">
                                                Create with All Fields
                                                <Icons.ArrowRight />
                                            </span>
                                        )}
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Advanced Mode Form */}
                    {mode === 'advanced' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div>
                                <label className="input-label">Report Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="My Custom Report"
                                    value={reportName}
                                    onChange={e => setReportName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    placeholder="What does this report do?"
                                    value={reportDescription}
                                    onChange={e => setReportDescription(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="input-label">Output Format</label>
                                <div className="flex gap-3 mt-2">
                                    {OUTPUT_FORMATS.map((format) => (
                                        <button
                                            key={format.value}
                                            onClick={() => setOutputFormat(format.value)}
                                            className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${
                                                outputFormat === format.value
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="font-medium text-gray-900">{format.label}</div>
                                            <div className="text-xs text-gray-500">{format.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="input-label">Python Code (Optional)</label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Write custom transformation logic.
                                </p>
                                <textarea
                                    className="input font-mono text-sm"
                                    rows={8}
                                    placeholder={`def transform(data):
    # Transform your data here
    return data`}
                                    value={pythonCode}
                                    onChange={e => setPythonCode(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={mode === null ? handleClose : () => setMode(null)}
                        className="btn btn-secondary"
                    >
                        <Icons.ChevronLeft />
                        <span className="ml-1">{mode === null ? 'Cancel' : 'Back'}</span>
                    </button>

                    {mode === 'advanced' && (
                        <button
                            onClick={() => createAdvancedMutation.mutate()}
                            disabled={!reportName.trim() || createAdvancedMutation.isLoading}
                            className="btn btn-primary"
                        >
                            {createAdvancedMutation.isLoading ? 'Creating...' : 'Create Report'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
