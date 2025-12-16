import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { reportsAPI, connectorsAPI, destinationsAPI, reportDestinationsAPI, streamingAPI } from '../services/api';
import Editor from '@monaco-editor/react';
import ReportWizard from '../components/ReportWizard';

interface Report {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
    current_version_id: string | null;
    created_at: string;
}

interface ReportVersion {
    id: string;
    report_id: string;
    major_version: number;
    minor_version: number;
    version_number: number;
    version_string: string;
    python_code: string;
    connector_id: string | null;
    config: Record<string, any>;
    status: string;
    created_at: string;
}

// Icons
const Icons = {
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    Edit: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
    ),
    Play: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
        </svg>
    ),
    Trash: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
    ),
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    Document: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
    ),
    Code: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
        </svg>
    ),
    Maximize: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
    ),
    Minimize: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
        </svg>
    ),
    Sun: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
    ),
    Moon: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
    ),
};

const DEFAULT_CODE = `"""
Report Transformation Logic

Available context:
- db: Database connection object
- mappings: Cross-reference lookup functions
- params: Report parameters

Return format:
- Return a list of dictionaries for CSV output
- Return XML string for XML output
"""

def transform(db, mappings, params):
    # Example: Query data from the connected database
    # query = "SELECT * FROM transactions WHERE date >= :start_date"
    # rows = db.execute(query, {"start_date": params.get("start_date")})
    
    # Example: Apply cross-reference mapping
    # mapped_value = mappings.lookup("venue_mapping", source_value)
    
    # Return the transformed data
    return [
        {"column1": "value1", "column2": "value2"},
        {"column1": "value3", "column2": "value4"},
    ]
`;

export default function Reports() {
    const queryClient = useQueryClient();
    const [showWizard, setShowWizard] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [deletingReport, setDeletingReport] = useState<Report | null>(null);
    const [editorTab, setEditorTab] = useState<'code' | 'history' | 'config' | 'delivery' | 'streaming'>('code');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('editor-dark-mode');
        return saved ? JSON.parse(saved) : false;
    });
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [bumpMajor, setBumpMajor] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<ReportVersion | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [pythonCode, setPythonCode] = useState(DEFAULT_CODE);
    const [connectorId, setConnectorId] = useState('');
    const [executing, setExecuting] = useState(false);
    const [showExecuteModal, setShowExecuteModal] = useState(false);
    const [executeReport, setExecuteReport] = useState<Report | null>(null);
    const [businessDateFrom, setBusinessDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [businessDateTo, setBusinessDateTo] = useState(new Date().toISOString().split('T')[0]);

    // Output format config
    const [outputFormat, setOutputFormat] = useState('xml');
    const [maxRecords, setMaxRecords] = useState<number | null>(null);
    const [maxFileSizeMB, setMaxFileSizeMB] = useState<number | null>(null);
    const [splitLimitType, setSplitLimitType] = useState<'none' | 'records' | 'size'>('none');
    const [csvDelimiter, setCsvDelimiter] = useState(',');
    const [csvQuote, setCsvQuote] = useState('"');
    const [csvHeader, setCsvHeader] = useState(true);

    // XML options
    const [xmlRootElement, setXmlRootElement] = useState('Report');
    const [xmlIncludeDeclaration, setXmlIncludeDeclaration] = useState(true);
    const [xmlPrettyPrint, setXmlPrettyPrint] = useState(true);

    // JSON options
    const [jsonPrettyPrint, setJsonPrettyPrint] = useState(true);
    const [jsonWrapInArray, setJsonWrapInArray] = useState(false);

    // TXT (Fixed-width) options
    const [txtRecordLength, setTxtRecordLength] = useState(500);
    const [txtPaddingChar, setTxtPaddingChar] = useState(' ');
    const [txtLineEnding, setTxtLineEnding] = useState('CRLF');

    // Filename configuration
    const [filenameTemplate, setFilenameTemplate] = useState('{report_name}_{business_date}_{version}');
    const [filenameTokens, setFilenameTokens] = useState({
        includeReportName: true,
        includeBusinessDate: true,
        dateFormat: 'YYYYMMDD',
        includeVersion: true,
        includeSequence: false,
        sequenceFormat: '3',
        includeTimestamp: false,
        customPrefix: '',
        customSuffix: '',
    });

    const { data: reports, isLoading } = useQuery('reports', () =>
        reportsAPI.list().then((res) => res.data)
    );

    const { data: connectors } = useQuery('connectors', () =>
        connectorsAPI.list().then((res) => res.data)
    );

    // Fetch execution history and stats for selected report
    const { data: executions } = useQuery(
        ['report-executions', selectedReport?.id],
        () => selectedReport ? reportsAPI.getExecutions(selectedReport.id, { limit: 10 }).then((res) => res.data) : null,
        { enabled: !!selectedReport }
    );

    const { data: reportStats } = useQuery(
        ['report-stats', selectedReport?.id],
        () => selectedReport ? reportsAPI.getStats(selectedReport.id).then((res) => res.data) : null,
        { enabled: !!selectedReport }
    );

    // Fetch version history
    const { data: reportVersions } = useQuery(
        ['report-versions', selectedReport?.id],
        () => selectedReport ? reportsAPI.getVersions(selectedReport.id).then((res) => res.data) : null,
        { enabled: !!selectedReport }
    );

    // Fetch all destinations for linking dropdown
    const { data: allDestinations } = useQuery('destinations', () =>
        destinationsAPI.list().then((res) => res.data)
    );

    // Fetch linked destinations for selected report
    const { data: linkedDestinations, refetch: refetchLinkedDestinations } = useQuery(
        ['report-destinations', selectedReport?.id],
        () => selectedReport ? reportDestinationsAPI.list(selectedReport.id).then((res) => res.data) : [],
        { enabled: !!selectedReport }
    );

    // Fetch streaming topics for linking
    const { data: streamingTopics } = useQuery('streaming-topics', () =>
        streamingAPI.listTopics().then((res) => res.data)
    );

    // Streaming config state for selected report
    const [streamingConfig, setStreamingConfig] = useState<{
        enabled: boolean;
        topic_id: string;
        trigger_mode: string;
        window_minutes: number;
        threshold_count: number;
    }>({
        enabled: false,
        topic_id: '',
        trigger_mode: 'combined',
        window_minutes: 15,
        threshold_count: 10000
    });

    const createMutation = useMutation(
        (data: any) => reportsAPI.create(data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('reports');
                closeCreateModal();
            },
        }
    );

    const updateMutation = useMutation(
        ({ id, data }: { id: string; data: any }) => reportsAPI.update(id, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('reports');
            },
        }
    );

    const createVersionMutation = useMutation(
        ({ reportId, data }: { reportId: string; data: any }) =>
            reportsAPI.createVersion(reportId, data),
        {
            onSuccess: async (response, variables) => {
                // After creating version, set it as current and reload
                const newVersion = response.data;
                // Approve the new version to make it current
                try {
                    await reportsAPI.updateVersion(variables.reportId, newVersion.id, {
                        approve: true
                    });
                } catch (err) {
                    console.log('Version created, approval may be manual');
                }
                queryClient.invalidateQueries('reports');
                queryClient.invalidateQueries(['report-versions', variables.reportId]);
                // Update current version state
                setCurrentVersion(newVersion);
            },
        }
    );

    const deleteMutation = useMutation(
        (id: string) => reportsAPI.delete(id),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('reports');
                setShowDeleteModal(false);
                setDeletingReport(null);
            },
        }
    );

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setName('');
        setDescription('');
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setSelectedReport(null);
        setPythonCode(DEFAULT_CODE);
        setConnectorId('');
        setEditorTab('code');
    };

    const openEditModal = async (report: Report) => {
        setSelectedReport(report);
        setShowEditModal(true);
        setHasUnsavedChanges(false);
        setBumpMajor(false);

        // Load saved code from version if available
        if (report.current_version_id) {
            try {
                const versionsRes = await reportsAPI.getVersions(report.id);
                const versions = versionsRes.data;
                if (versions && versions.length > 0) {
                    // Find the current version
                    const ver = versions.find((v: ReportVersion) => v.id === report.current_version_id) || versions[0];
                    setCurrentVersion(ver);
                    setPythonCode(ver.python_code || DEFAULT_CODE);
                    if (ver.connector_id) {
                        setConnectorId(ver.connector_id);
                    }
                    // Load config
                    if (ver.config) {
                        setOutputFormat(ver.config.output_format || 'xml');
                        setMaxRecords(ver.config.max_records_per_file || null);
                        if (ver.config.csv_options) {
                            setCsvDelimiter(ver.config.csv_options.delimiter || ',');
                            setCsvQuote(ver.config.csv_options.quote_char || '"');
                            setCsvHeader(ver.config.csv_options.include_header !== false);
                        }
                    }
                    return;
                }
            } catch (err) {
                console.error('Failed to load report version:', err);
            }
        }
        setCurrentVersion(null);
        setPythonCode(DEFAULT_CODE);
    };

    const handleCreate = () => {
        createMutation.mutate({ name, description });
    };

    const handleSaveCode = () => {
        if (!selectedReport) return;
        // Show confirmation modal
        setShowSaveConfirm(true);
    };

    const handleConfirmSave = () => {
        if (!selectedReport) return;
        setShowSaveConfirm(false);

        // Create a NEW version instead of updating report metadata
        createVersionMutation.mutate({
            reportId: selectedReport.id,
            data: {
                python_code: pythonCode,
                connector_id: connectorId || null,
                bump_major: bumpMajor,
                config: {
                    output_format: outputFormat,
                    max_records_per_file: maxRecords,
                    csv_options: outputFormat === 'csv' ? {
                        delimiter: csvDelimiter,
                        quote_char: csvQuote,
                        include_header: csvHeader
                    } : undefined
                }
            },
        });
        setHasUnsavedChanges(false);
        setBumpMajor(false);
    };

    const handleExecute = async () => {
        if (!executeReport) return;

        setExecuting(true);
        try {
            await reportsAPI.execute(executeReport.id, {
                business_date_from: businessDateFrom,
                business_date_to: businessDateTo
            });
            queryClient.invalidateQueries('recent-runs');
            setShowExecuteModal(false);
            setExecuteReport(null);
            alert('Report execution started! Check the Runs page for status.');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Execution failed');
        } finally {
            setExecuting(false);
        }
    };

    const openExecuteModal = (report: Report) => {
        setExecuteReport(report);
        setBusinessDateFrom(new Date().toISOString().split('T')[0]);
        setBusinessDateTo(new Date().toISOString().split('T')[0]);
        setShowExecuteModal(true);
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="page-title">Reports</h1>
                    <p className="page-description">
                        Manage your regulatory reports and transformation logic
                    </p>
                </div>
                <button onClick={() => setShowWizard(true)} className="btn btn-primary">
                    <Icons.Plus />
                    <span className="ml-2">Create Report</span>
                </button>
            </div>

            {/* Reports Table */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                    <p className="mt-3 text-sm text-gray-500">Loading reports...</p>
                </div>
            ) : reports && reports.length > 0 ? (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Version</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((report: Report) => (
                                <tr key={report.id}>
                                    <td className="font-medium text-gray-900">{report.name}</td>
                                    <td className="max-w-xs truncate">{report.description || '-'}</td>
                                    <td>
                                        <span className={`badge ${report.is_active ? 'badge-success' : 'badge-gray'}`}>
                                            {report.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        {(report as any).version_string ? (
                                            <span className="badge badge-info">
                                                {(report as any).version_string}
                                            </span>
                                        ) : report.current_version_id ? (
                                            <span className="badge badge-info">
                                                v{(report as any).major_version || 1}.{(report as any).minor_version || 0}
                                            </span>
                                        ) : (
                                            <span className="badge badge-warning">Draft</span>
                                        )}
                                    </td>
                                    <td className="text-gray-500">
                                        {new Date(report.created_at).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(report)}
                                                className="btn btn-ghost btn-icon text-indigo-600"
                                                title="Edit"
                                            >
                                                <Icons.Code />
                                            </button>
                                            <button
                                                onClick={() => openExecuteModal(report)}
                                                className="btn btn-ghost btn-icon text-emerald-600"
                                                title="Execute"
                                            >
                                                <Icons.Play />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setDeletingReport(report);
                                                    setShowDeleteModal(true);
                                                }}
                                                className="btn btn-ghost btn-icon text-red-600"
                                                title="Delete"
                                            >
                                                <Icons.Trash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">
                    <div className="text-gray-300 mx-auto">
                        <Icons.Document />
                    </div>
                    <h3 className="empty-state-title">No reports yet</h3>
                    <p className="empty-state-description">
                        Create your first regulatory report to get started
                    </p>
                    <button onClick={() => setShowCreateModal(true)} className="btn btn-primary mt-4">
                        <Icons.Plus />
                        <span className="ml-2">Create Report</span>
                    </button>
                </div>
            )}

            {/* Create Report Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={closeCreateModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Create New Report</h3>
                            <button onClick={closeCreateModal} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div>
                                <label className="input-label">Report Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="MiFIR Transaction Report"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="Daily transaction reporting for MiFIR compliance"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={closeCreateModal} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!name || createMutation.isLoading}
                                className="btn btn-primary"
                            >
                                {createMutation.isLoading ? 'Creating...' : 'Create Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Creation Wizard */}
            <ReportWizard
                isOpen={showWizard}
                onClose={() => setShowWizard(false)}
                onSuccess={() => {
                    setShowWizard(false);
                    queryClient.invalidateQueries('reports');
                }}
            />

            {/* Edit Report Modal with Code Editor */}
            {showEditModal && selectedReport && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div
                        className={`bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col ${isFullscreen
                            ? 'fixed inset-4 max-w-none max-h-none'
                            : 'w-full max-w-[90vw] max-h-[90vh]'
                            }`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ animation: 'modalSlideIn 0.2s ease-out' }}
                    >
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">{selectedReport.name}</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Edit and view execution history
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const newMode = !isDarkMode;
                                        setIsDarkMode(newMode);
                                        localStorage.setItem('editor-dark-mode', JSON.stringify(newMode));
                                    }}
                                    className="btn btn-ghost btn-icon"
                                    title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                                >
                                    {isDarkMode ? <Icons.Sun /> : <Icons.Moon />}
                                </button>
                                <button
                                    onClick={() => setIsFullscreen(!isFullscreen)}
                                    className="btn btn-ghost btn-icon"
                                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                >
                                    {isFullscreen ? <Icons.Minimize /> : <Icons.Maximize />}
                                </button>
                                <button onClick={closeEditModal} className="btn btn-ghost btn-icon">
                                    <Icons.Close />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 px-6 pt-4 bg-gray-50 border-b border-gray-200">
                            <button
                                onClick={() => setEditorTab('code')}
                                className={`px-4 py-2.5 text-sm font-medium transition-all ${editorTab === 'code'
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Code Editor
                            </button>
                            <button
                                onClick={() => setEditorTab('config')}
                                className={`px-4 py-2.5 text-sm font-medium transition-all ${editorTab === 'config'
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Output Config
                            </button>
                            <button
                                onClick={() => setEditorTab('history')}
                                className={`px-4 py-2.5 text-sm font-medium transition-all ${editorTab === 'history'
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Version History
                            </button>
                            <button
                                onClick={() => setEditorTab('delivery')}
                                className={`px-4 py-2.5 text-sm font-medium transition-all ${editorTab === 'delivery'
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Delivery
                            </button>
                            <button
                                onClick={() => setEditorTab('streaming')}
                                className={`px-4 py-2.5 text-sm font-medium transition-all ${editorTab === 'streaming'
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Streaming
                            </button>
                            {hasUnsavedChanges && (
                                <span className="ml-auto text-sm text-amber-600 flex items-center">
                                    <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                                    Unsaved changes
                                </span>
                            )}
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Code Editor Tab */}
                            {editorTab === 'code' && (
                                <>
                                    <div className="flex-1 border-r border-gray-200">
                                        <Editor
                                            height="100%"
                                            defaultLanguage="python"
                                            value={pythonCode}
                                            onChange={(value) => {
                                                setPythonCode(value || '');
                                                setHasUnsavedChanges(true);
                                            }}
                                            theme={isDarkMode ? 'vs-dark' : 'vs-light'}
                                            options={{
                                                minimap: { enabled: true },
                                                fontSize: 14,
                                                lineNumbers: 'on',
                                                scrollBeyondLastLine: false,
                                                automaticLayout: true,
                                                tabSize: 4,
                                                wordWrap: 'on',
                                            }}
                                        />
                                    </div>

                                    {/* Sidebar */}
                                    <div className="w-72 p-4 bg-gray-50 overflow-y-auto">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-4">Configuration</h4>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="input-label">Data Source</label>
                                                <select
                                                    className="select"
                                                    value={connectorId}
                                                    onChange={(e) => setConnectorId(e.target.value)}
                                                >
                                                    <option value="">Select connector...</option>
                                                    {connectors?.map((c: any) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.name} ({c.type})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-6 border-t border-gray-200">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Reference</h4>
                                            <div className="text-xs text-gray-600 space-y-2 bg-white p-3 rounded-lg border border-gray-200">
                                                <p><code className="text-indigo-600">db.execute(query, params)</code></p>
                                                <p className="text-gray-500">Execute SQL query</p>
                                                <p className="mt-2"><code className="text-indigo-600">mappings.lookup(set, value)</code></p>
                                                <p className="text-gray-500">Cross-reference lookup</p>
                                                <p className="mt-2"><code className="text-indigo-600">params.get(name)</code></p>
                                                <p className="text-gray-500">Get report parameter</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Output Config Tab */}
                            {editorTab === 'config' && (
                                <div className="flex-1 p-6 overflow-y-auto">
                                    <div className="max-w-2xl">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-6">Output Configuration</h3>

                                        {/* Output Format Selection */}
                                        <div className="mb-6">
                                            <label className="input-label">Output Format</label>
                                            <div className="grid grid-cols-4 gap-3 mt-2">
                                                {['xml', 'json', 'csv', 'txt'].map((fmt) => (
                                                    <button
                                                        key={fmt}
                                                        onClick={() => setOutputFormat(fmt)}
                                                        className={`p-3 rounded-lg border-2 text-center transition-all ${outputFormat === fmt
                                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                            }`}
                                                    >
                                                        <span className="font-medium uppercase">{fmt}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* XML Options - shown when XML is selected */}
                                        {outputFormat === 'xml' && (
                                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                                                <h4 className="font-medium text-gray-900 mb-4">XML Options</h4>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="input-label">Root Element Name</label>
                                                        <input
                                                            type="text"
                                                            className="input mt-1"
                                                            placeholder="e.g., Report"
                                                            value={xmlRootElement}
                                                            onChange={(e) => setXmlRootElement(e.target.value)}
                                                        />
                                                    </div>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={xmlIncludeDeclaration}
                                                            onChange={(e) => setXmlIncludeDeclaration(e.target.checked)}
                                                            className="rounded"
                                                        />
                                                        <span className="text-sm text-gray-700">Include XML declaration</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={xmlPrettyPrint}
                                                            onChange={(e) => setXmlPrettyPrint(e.target.checked)}
                                                            className="rounded"
                                                        />
                                                        <span className="text-sm text-gray-700">Pretty print (indented)</span>
                                                    </label>
                                                </div>
                                                {/* XML Preview */}
                                                <div className="mt-4 bg-gray-900 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-gray-400 text-xs uppercase">Output Preview</span>
                                                        <span className="text-gray-500 text-xs">XML</span>
                                                    </div>
                                                    <pre className="text-green-400 font-mono text-sm overflow-x-auto">{xmlPrettyPrint
                                                        ? `${xmlIncludeDeclaration ? '<?xml version="1.0"?>\n' : ''}<${xmlRootElement}>\n  <Record>\n    <Field1>value1</Field1>\n  </Record>\n</${xmlRootElement}>`
                                                        : `${xmlIncludeDeclaration ? '<?xml version="1.0"?>' : ''}<${xmlRootElement}><Record><Field1>value1</Field1></Record></${xmlRootElement}>`
                                                    }</pre>
                                                </div>
                                            </div>
                                        )}

                                        {/* JSON Options - shown when JSON is selected */}
                                        {outputFormat === 'json' && (
                                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                                                <h4 className="font-medium text-gray-900 mb-4">JSON Options</h4>
                                                <div className="space-y-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={jsonPrettyPrint}
                                                            onChange={(e) => setJsonPrettyPrint(e.target.checked)}
                                                            className="rounded"
                                                        />
                                                        <span className="text-sm text-gray-700">Pretty print (indented)</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={jsonWrapInArray}
                                                            onChange={(e) => setJsonWrapInArray(e.target.checked)}
                                                            className="rounded"
                                                        />
                                                        <span className="text-sm text-gray-700">Wrap in array</span>
                                                    </label>
                                                </div>
                                                {/* JSON Preview */}
                                                <div className="mt-4 bg-gray-900 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-gray-400 text-xs uppercase">Output Preview</span>
                                                        <span className="text-gray-500 text-xs">JSON</span>
                                                    </div>
                                                    <pre className="text-green-400 font-mono text-sm overflow-x-auto">{jsonPrettyPrint
                                                        ? (jsonWrapInArray
                                                            ? `[\n  {\n    "field1": "value1",\n    "field2": "value2"\n  }\n]`
                                                            : `{\n  "field1": "value1",\n  "field2": "value2"\n}`)
                                                        : (jsonWrapInArray
                                                            ? `[{"field1":"value1","field2":"value2"}]`
                                                            : `{"field1":"value1","field2":"value2"}`)
                                                    }</pre>
                                                </div>
                                            </div>
                                        )}

                                        {/* CSV Options - shown when CSV is selected */}
                                        {outputFormat === 'csv' && (
                                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                                                <h4 className="font-medium text-gray-900 mb-4">CSV Options</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="input-label">Delimiter</label>
                                                        <select
                                                            className="select mt-1"
                                                            value={csvDelimiter}
                                                            onChange={(e) => setCsvDelimiter(e.target.value)}
                                                        >
                                                            <option value=",">Comma (,)</option>
                                                            <option value=";">Semicolon (;)</option>
                                                            <option value="\t">Tab</option>
                                                            <option value="|">Pipe (|)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="input-label">Quote Character</label>
                                                        <select
                                                            className="select mt-1"
                                                            value={csvQuote}
                                                            onChange={(e) => setCsvQuote(e.target.value)}
                                                        >
                                                            <option value='"'>Double Quote (")</option>
                                                            <option value="'">Single Quote (')</option>
                                                            <option value="">None</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={csvHeader}
                                                                onChange={(e) => setCsvHeader(e.target.checked)}
                                                                className="rounded"
                                                            />
                                                            <span className="text-sm text-gray-700">Include header row</span>
                                                        </label>
                                                    </div>
                                                </div>
                                                {/* CSV Preview */}
                                                <div className="mt-4 bg-gray-900 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-gray-400 text-xs uppercase">Output Preview</span>
                                                        <span className="text-gray-500 text-xs">CSV</span>
                                                    </div>
                                                    <pre className="text-green-400 font-mono text-sm overflow-x-auto">{`${csvHeader ? `${csvQuote}field1${csvQuote}${csvDelimiter}${csvQuote}field2${csvQuote}${csvDelimiter}${csvQuote}field3${csvQuote}\n` : ''}${csvQuote}value1${csvQuote}${csvDelimiter}${csvQuote}value2${csvQuote}${csvDelimiter}${csvQuote}value3${csvQuote}\n${csvQuote}value4${csvQuote}${csvDelimiter}${csvQuote}value5${csvQuote}${csvDelimiter}${csvQuote}value6${csvQuote}`}</pre>
                                                </div>
                                            </div>
                                        )}

                                        {/* TXT (Fixed-Width) Options - shown when TXT is selected */}
                                        {outputFormat === 'txt' && (
                                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                                                <h4 className="font-medium text-gray-900 mb-4">Fixed-Width Text Options</h4>
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="input-label">Total Record Length</label>
                                                            <input
                                                                type="number"
                                                                className="input mt-1"
                                                                placeholder="e.g., 500"
                                                                value={txtRecordLength}
                                                                onChange={(e) => setTxtRecordLength(parseInt(e.target.value) || 500)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="input-label">Padding Character</label>
                                                            <select
                                                                className="select mt-1"
                                                                value={txtPaddingChar}
                                                                onChange={(e) => setTxtPaddingChar(e.target.value)}
                                                            >
                                                                <option value=" ">Space</option>
                                                                <option value="0">Zero (0)</option>
                                                                <option value="_">Underscore (_)</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="input-label">Line Ending</label>
                                                        <select
                                                            className="select mt-1"
                                                            value={txtLineEnding}
                                                            onChange={(e) => setTxtLineEnding(e.target.value)}
                                                        >
                                                            <option value="CRLF">Windows (CRLF)</option>
                                                            <option value="LF">Unix (LF)</option>
                                                            <option value="CR">Classic Mac (CR)</option>
                                                        </select>
                                                    </div>
                                                    <div className="bg-white p-3 rounded border border-gray-200">
                                                        <p className="text-sm text-gray-500">
                                                            <strong>Note:</strong> Column positions are defined in your Python code using the <code className="text-indigo-600">format_fixed_width()</code> helper function.
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* TXT Preview */}
                                                <div className="mt-4 bg-gray-900 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-gray-400 text-xs uppercase">Output Preview</span>
                                                        <span className="text-gray-500 text-xs">TXT (Record: {txtRecordLength} chars, {txtLineEnding})</span>
                                                    </div>
                                                    <pre className="text-green-400 font-mono text-sm overflow-x-auto">{`FIELD1${txtPaddingChar.repeat(4)}FIELD2${txtPaddingChar.repeat(4)}FIELD3${txtPaddingChar.repeat(4)}\nVALUE1${txtPaddingChar.repeat(4)}VALUE2${txtPaddingChar.repeat(4)}VALUE3${txtPaddingChar.repeat(4)}`}</pre>
                                                </div>
                                            </div>
                                        )}

                                        {/* File Splitting Options */}
                                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                                            <h4 className="font-medium text-gray-900 mb-4">File Splitting (Optional)</h4>
                                            <p className="text-sm text-gray-500 mb-4">
                                                Split large outputs into multiple files. Choose one limit type or leave disabled.
                                            </p>

                                            <div className="space-y-3">
                                                <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-gray-300">
                                                    <input
                                                        type="radio"
                                                        name="splitLimit"
                                                        checked={splitLimitType === 'none'}
                                                        onChange={() => setSplitLimitType('none')}
                                                        className="mt-0.5"
                                                    />
                                                    <div>
                                                        <span className="font-medium text-gray-900">No splitting</span>
                                                        <p className="text-sm text-gray-500">Output all records to a single file</p>
                                                    </div>
                                                </label>

                                                <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-gray-300">
                                                    <input
                                                        type="radio"
                                                        name="splitLimit"
                                                        checked={splitLimitType === 'records'}
                                                        onChange={() => setSplitLimitType('records')}
                                                        className="mt-0.5"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="font-medium text-gray-900">Split by record count</span>
                                                        <p className="text-sm text-gray-500 mb-2">Create new file after N records</p>
                                                        {splitLimitType === 'records' && (
                                                            <input
                                                                type="number"
                                                                className="input w-40"
                                                                placeholder="e.g., 10000"
                                                                value={maxRecords || ''}
                                                                onChange={(e) => setMaxRecords(e.target.value ? parseInt(e.target.value) : null)}
                                                            />
                                                        )}
                                                    </div>
                                                </label>

                                                <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-gray-300">
                                                    <input
                                                        type="radio"
                                                        name="splitLimit"
                                                        checked={splitLimitType === 'size'}
                                                        onChange={() => setSplitLimitType('size')}
                                                        className="mt-0.5"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="font-medium text-gray-900">Split by file size</span>
                                                        <p className="text-sm text-gray-500 mb-2">Create new file when size exceeds limit</p>
                                                        {splitLimitType === 'size' && (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    className="input w-32"
                                                                    placeholder="e.g., 100"
                                                                    value={maxFileSizeMB || ''}
                                                                    onChange={(e) => setMaxFileSizeMB(e.target.value ? parseInt(e.target.value) : null)}
                                                                />
                                                                <span className="text-gray-600 text-sm">MB</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Filename Generator */}
                                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                                            <h4 className="font-medium text-gray-900 mb-4">Filename Template</h4>
                                            <p className="text-sm text-gray-500 mb-4">
                                                Configure how output files are named using tokens and custom text.
                                            </p>

                                            {/* Template Preview */}
                                            <div className="bg-gray-900 rounded-lg p-3 mb-4">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-gray-400 text-xs uppercase">Preview</span>
                                                </div>
                                                <code className="text-green-400 text-sm">
                                                    {filenameTokens.customPrefix}
                                                    {filenameTokens.includeReportName ? 'MiFIR_Report' : ''}
                                                    {filenameTokens.includeReportName && (filenameTokens.includeBusinessDate || filenameTokens.includeVersion || filenameTokens.includeSequence || filenameTokens.includeTimestamp) ? '_' : ''}
                                                    {filenameTokens.includeBusinessDate ? (filenameTokens.dateFormat === 'YYYYMMDD' ? '20241214' : filenameTokens.dateFormat === 'YYYY-MM-DD' ? '2024-12-14' : '14-12-2024') : ''}
                                                    {filenameTokens.includeBusinessDate && (filenameTokens.includeVersion || filenameTokens.includeSequence || filenameTokens.includeTimestamp) ? '_' : ''}
                                                    {filenameTokens.includeVersion ? 'v1.2' : ''}
                                                    {filenameTokens.includeVersion && (filenameTokens.includeSequence || filenameTokens.includeTimestamp) ? '_' : ''}
                                                    {filenameTokens.includeSequence ? (filenameTokens.sequenceFormat === '2' ? '01' : filenameTokens.sequenceFormat === '3' ? '001' : '0001') : ''}
                                                    {filenameTokens.includeSequence && filenameTokens.includeTimestamp ? '_' : ''}
                                                    {filenameTokens.includeTimestamp ? '143052' : ''}
                                                    {filenameTokens.customSuffix}
                                                    .{outputFormat}
                                                </code>
                                            </div>

                                            {/* Token Configuration */}
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="input-label">Custom Prefix</label>
                                                        <input
                                                            type="text"
                                                            className="input mt-1"
                                                            placeholder="e.g., FIRM_"
                                                            value={filenameTokens.customPrefix}
                                                            onChange={(e) => setFilenameTokens({ ...filenameTokens, customPrefix: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="input-label">Custom Suffix</label>
                                                        <input
                                                            type="text"
                                                            className="input mt-1"
                                                            placeholder="e.g., _FINAL"
                                                            value={filenameTokens.customSuffix}
                                                            onChange={(e) => setFilenameTokens({ ...filenameTokens, customSuffix: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="border-t border-gray-200 pt-4">
                                                    <p className="text-sm font-medium text-gray-700 mb-3">Include in filename:</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={filenameTokens.includeReportName}
                                                                onChange={(e) => setFilenameTokens({ ...filenameTokens, includeReportName: e.target.checked })}
                                                                className="rounded"
                                                            />
                                                            <span className="text-sm text-gray-700">Report Name</span>
                                                        </label>

                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={filenameTokens.includeVersion}
                                                                onChange={(e) => setFilenameTokens({ ...filenameTokens, includeVersion: e.target.checked })}
                                                                className="rounded"
                                                            />
                                                            <span className="text-sm text-gray-700">Version (v1.2)</span>
                                                        </label>

                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={filenameTokens.includeBusinessDate}
                                                                onChange={(e) => setFilenameTokens({ ...filenameTokens, includeBusinessDate: e.target.checked })}
                                                                className="rounded"
                                                            />
                                                            <span className="text-sm text-gray-700">Business Date</span>
                                                        </label>

                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={filenameTokens.includeTimestamp}
                                                                onChange={(e) => setFilenameTokens({ ...filenameTokens, includeTimestamp: e.target.checked })}
                                                                className="rounded"
                                                            />
                                                            <span className="text-sm text-gray-700">Timestamp (HHMMSS)</span>
                                                        </label>

                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={filenameTokens.includeSequence}
                                                                onChange={(e) => setFilenameTokens({ ...filenameTokens, includeSequence: e.target.checked })}
                                                                className="rounded"
                                                            />
                                                            <span className="text-sm text-gray-700">Sequence Number</span>
                                                        </label>
                                                    </div>
                                                </div>

                                                {/* Date Format Options */}
                                                {filenameTokens.includeBusinessDate && (
                                                    <div className="border-t border-gray-200 pt-4">
                                                        <label className="input-label">Date Format</label>
                                                        <select
                                                            className="select mt-1"
                                                            value={filenameTokens.dateFormat}
                                                            onChange={(e) => setFilenameTokens({ ...filenameTokens, dateFormat: e.target.value })}
                                                        >
                                                            <option value="YYYYMMDD">YYYYMMDD (20241214)</option>
                                                            <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-14)</option>
                                                            <option value="DD-MM-YYYY">DD-MM-YYYY (14-12-2024)</option>
                                                            <option value="MMDDYYYY">MMDDYYYY (12142024)</option>
                                                        </select>
                                                    </div>
                                                )}

                                                {/* Sequence Format Options */}
                                                {filenameTokens.includeSequence && (
                                                    <div className="border-t border-gray-200 pt-4">
                                                        <label className="input-label">Sequence Padding</label>
                                                        <select
                                                            className="select mt-1"
                                                            value={filenameTokens.sequenceFormat}
                                                            onChange={(e) => setFilenameTokens({ ...filenameTokens, sequenceFormat: e.target.value })}
                                                        >
                                                            <option value="2">2 digits (01, 02, ...)</option>
                                                            <option value="3">3 digits (001, 002, ...)</option>
                                                            <option value="4">4 digits (0001, 0002, ...)</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>


                                    </div>
                                </div>
                            )}

                            {/* History Tab */}
                            {editorTab === 'history' && (
                                <div className="flex-1 p-6 overflow-y-auto">
                                    {/* Version History Section */}
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Version History</h4>
                                    {reportVersions && reportVersions.length > 0 ? (
                                        <div className="table-container mb-8">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Version</th>
                                                        <th>Status</th>
                                                        <th>Created</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reportVersions.map((ver: ReportVersion) => (
                                                        <tr key={ver.id} className={ver.id === selectedReport?.current_version_id ? 'bg-indigo-50' : ''}>
                                                            <td>
                                                                <span className={`badge ${ver.id === selectedReport?.current_version_id ? 'badge-primary' : 'badge-info'}`}>
                                                                    {ver.version_string || `v${ver.major_version || 1}.${ver.minor_version || 0}`}
                                                                </span>
                                                                {ver.id === selectedReport?.current_version_id && (
                                                                    <span className="ml-2 text-xs text-indigo-600">Current</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className={`badge badge-${ver.status === 'active' ? 'success' : ver.status === 'draft' ? 'warning' : 'gray'}`}>
                                                                    {ver.status}
                                                                </span>
                                                            </td>
                                                            <td className="text-gray-600 text-sm">
                                                                {new Date(ver.created_at).toLocaleString()}
                                                            </td>
                                                            <td>
                                                                <button
                                                                    onClick={() => {
                                                                        setPythonCode(ver.python_code);
                                                                        setCurrentVersion(ver);
                                                                        setEditorTab('code');
                                                                    }}
                                                                    className="btn btn-ghost btn-sm text-indigo-600"
                                                                >
                                                                    View Code
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500 mb-8 bg-gray-50 rounded-lg">
                                            <p>No versions yet</p>
                                            <p className="text-sm mt-1">Save your code to create the first version</p>
                                        </div>
                                    )}

                                    {/* Statistics Cards */}
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Execution Statistics</h4>
                                    {reportStats && (
                                        <div className="grid grid-cols-3 gap-4 mb-6">
                                            <div className="card p-4">
                                                <p className="text-sm text-gray-500">Total Executions</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                                    {reportStats.total_executions}
                                                </p>
                                            </div>
                                            <div className="card p-4">
                                                <p className="text-sm text-gray-500">Success Rate</p>
                                                <p className="text-2xl font-bold text-emerald-600 mt-1">
                                                    {reportStats.success_rate}%
                                                </p>
                                            </div>
                                            <div className="card p-4">
                                                <p className="text-sm text-gray-500">Avg Duration</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                                    {reportStats.avg_duration_seconds}s
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Execution History Table */}
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Executions</h4>
                                    {executions && executions.data && executions.data.length > 0 ? (
                                        <div className="table-container">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Status</th>
                                                        <th>Started</th>
                                                        <th>Duration</th>
                                                        <th>Artifacts</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {executions.data.map((run: any) => (
                                                        <tr key={run.id}>
                                                            <td>
                                                                <span className={`badge ${run.status === 'success' ? 'badge-success' :
                                                                    run.status === 'failed' ? 'badge-danger' :
                                                                        run.status === 'running' ? 'badge-info' :
                                                                            'badge-warning'
                                                                    }`}>
                                                                    {run.status}
                                                                </span>
                                                            </td>
                                                            <td className="text-gray-600 text-sm">
                                                                {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                                                            </td>
                                                            <td className="text-gray-600">
                                                                {run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : '—'}
                                                            </td>
                                                            <td className="text-gray-600">
                                                                {run.artifact_count || 0}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                                            <p>No executions yet</p>
                                            <p className="text-sm mt-1">Execute this report to see history</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Delivery Tab */}
                            {editorTab === 'delivery' && (
                                <div className="flex-1 p-6 overflow-y-auto">
                                    <div className="max-w-2xl">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Auto-Delivery Settings</h3>
                                        <p className="text-sm text-gray-500 mb-6">
                                            Configure destinations where report artifacts are automatically delivered after successful execution.
                                        </p>

                                        {/* Add Destination */}
                                        <div className="mb-6">
                                            <label className="input-label">Add Destination</label>
                                            <div className="flex gap-2 mt-2">
                                                <select
                                                    className="select flex-1"
                                                    id="addDestinationSelect"
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Select a destination...</option>
                                                    {allDestinations?.filter((d: any) =>
                                                        !linkedDestinations?.some((ld: any) => ld.destination_id === d.id)
                                                    ).map((dest: any) => (
                                                        <option key={dest.id} value={dest.id}>
                                                            {dest.name} ({dest.protocol}) - {dest.host}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={async () => {
                                                        const select = document.getElementById('addDestinationSelect') as HTMLSelectElement;
                                                        const destId = select?.value;
                                                        if (!destId || !selectedReport) return;
                                                        try {
                                                            await reportDestinationsAPI.link(selectedReport.id, destId);
                                                            refetchLinkedDestinations();
                                                            select.value = '';
                                                        } catch (err: any) {
                                                            alert(err.response?.data?.detail || 'Failed to link destination');
                                                        }
                                                    }}
                                                    className="btn btn-primary"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>

                                        {/* Linked Destinations List */}
                                        <div className="space-y-3">
                                            <h4 className="font-medium text-gray-900">Linked Destinations</h4>
                                            {linkedDestinations && linkedDestinations.length > 0 ? (
                                                linkedDestinations.map((dest: any) => (
                                                    <div key={dest.destination_id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-2xl">{dest.protocol === 'sftp' ? '🔒' : '📁'}</span>
                                                                <div>
                                                                    <p className="font-medium text-gray-900">{dest.destination_name}</p>
                                                                    <p className="text-xs text-gray-500">{dest.protocol.toUpperCase()} • {dest.host}</p>
                                                                </div>
                                                                {!dest.is_active && (
                                                                    <span className="badge badge-warning">Inactive</span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    if (!selectedReport) return;
                                                                    if (!confirm(`Remove ${dest.destination_name} from auto-delivery?`)) return;
                                                                    try {
                                                                        await reportDestinationsAPI.unlink(selectedReport.id, dest.destination_id);
                                                                        refetchLinkedDestinations();
                                                                    } catch (err: any) {
                                                                        alert(err.response?.data?.detail || 'Failed to unlink destination');
                                                                    }
                                                                }}
                                                                className="btn btn-ghost text-red-600 hover:bg-red-50"
                                                            >
                                                                <Icons.Trash />
                                                            </button>
                                                        </div>
                                                        {/* Retry Settings Display */}
                                                        <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-4 gap-3 text-xs">
                                                            <div className="bg-white p-2 rounded border border-gray-100">
                                                                <span className="text-gray-500 block">Retries</span>
                                                                <span className="font-medium text-gray-900">{dest.max_retries}</span>
                                                            </div>
                                                            <div className="bg-white p-2 rounded border border-gray-100">
                                                                <span className="text-gray-500 block">Backoff</span>
                                                                <span className="font-medium text-gray-900 capitalize">{dest.retry_backoff}</span>
                                                            </div>
                                                            <div className="bg-white p-2 rounded border border-gray-100">
                                                                <span className="text-gray-500 block">Base Delay</span>
                                                                <span className="font-medium text-gray-900">{dest.retry_base_delay}s</span>
                                                            </div>
                                                            <div className="bg-white p-2 rounded border border-gray-100">
                                                                <span className="text-gray-500 block">Max Delay</span>
                                                                <span className="font-medium text-gray-900">{dest.retry_max_delay}s</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">
                                                    <p>No delivery destinations configured.</p>
                                                    <p className="text-sm mt-1">Add a destination above to enable auto-delivery.</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info Note */}
                                        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                            <p className="text-sm text-blue-800">
                                                <strong>💡 How it works:</strong> When this report runs successfully,
                                                artifacts will be automatically uploaded to all linked destinations
                                                using the configured retry policy and credentials.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Streaming Tab Content */}
                            {editorTab === 'streaming' && (
                                <div className="p-6 overflow-y-auto h-[500px]">
                                    <div className="space-y-6">
                                        {/* Enable/Disable Streaming */}
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <div>
                                                <h4 className="font-medium text-gray-900">Real-Time Streaming</h4>
                                                <p className="text-sm text-gray-500">Process transactions from Kafka/AMQ Streams</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={streamingConfig.enabled}
                                                    onChange={(e) => setStreamingConfig({ ...streamingConfig, enabled: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>

                                        {streamingConfig.enabled && (
                                            <>
                                                {/* Topic Selection */}
                                                <div>
                                                    <label className="input-label">Streaming Topic</label>
                                                    <select
                                                        className="select w-full"
                                                        value={streamingConfig.topic_id}
                                                        onChange={(e) => setStreamingConfig({ ...streamingConfig, topic_id: e.target.value })}
                                                    >
                                                        <option value="">Select a topic...</option>
                                                        {streamingTopics?.map((topic: any) => (
                                                            <option key={topic.id} value={topic.id}>
                                                                {topic.name} ({topic.topic_name})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {(!streamingTopics || streamingTopics.length === 0) && (
                                                        <p className="text-sm text-amber-600 mt-1">
                                                            No topics configured. <a href="/streaming" className="underline">Add one first</a>
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Trigger Mode */}
                                                <div>
                                                    <label className="input-label">Trigger Mode</label>
                                                    <select
                                                        className="select w-full"
                                                        value={streamingConfig.trigger_mode}
                                                        onChange={(e) => setStreamingConfig({ ...streamingConfig, trigger_mode: e.target.value })}
                                                    >
                                                        <option value="time_window">Time Window Only</option>
                                                        <option value="threshold">Threshold Only</option>
                                                        <option value="combined">Combined (whichever first)</option>
                                                        <option value="manual">Manual Only</option>
                                                    </select>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {streamingConfig.trigger_mode === 'time_window' && 'Trigger batch after specified time window'}
                                                        {streamingConfig.trigger_mode === 'threshold' && 'Trigger batch when message count reached'}
                                                        {streamingConfig.trigger_mode === 'combined' && 'Trigger on time window OR threshold, whichever comes first'}
                                                        {streamingConfig.trigger_mode === 'manual' && 'Only trigger manually via API or UI'}
                                                    </p>
                                                </div>

                                                {/* Time Window Setting */}
                                                {(streamingConfig.trigger_mode === 'time_window' || streamingConfig.trigger_mode === 'combined') && (
                                                    <div>
                                                        <label className="input-label">Time Window (minutes)</label>
                                                        <input
                                                            type="number"
                                                            className="input w-full"
                                                            value={streamingConfig.window_minutes}
                                                            onChange={(e) => setStreamingConfig({ ...streamingConfig, window_minutes: parseInt(e.target.value) || 15 })}
                                                            min={1}
                                                            max={1440}
                                                        />
                                                        <p className="text-xs text-gray-500 mt-1">Process buffered messages every {streamingConfig.window_minutes} minutes</p>
                                                    </div>
                                                )}

                                                {/* Threshold Setting */}
                                                {(streamingConfig.trigger_mode === 'threshold' || streamingConfig.trigger_mode === 'combined') && (
                                                    <div>
                                                        <label className="input-label">Message Threshold</label>
                                                        <input
                                                            type="number"
                                                            className="input w-full"
                                                            value={streamingConfig.threshold_count}
                                                            onChange={(e) => setStreamingConfig({ ...streamingConfig, threshold_count: parseInt(e.target.value) || 10000 })}
                                                            min={100}
                                                            step={1000}
                                                        />
                                                        <p className="text-xs text-gray-500 mt-1">Trigger when {streamingConfig.threshold_count.toLocaleString()} messages are buffered</p>
                                                    </div>
                                                )}

                                                {/* Save Button */}
                                                <div className="pt-4 border-t border-gray-200">
                                                    <button
                                                        onClick={async () => {
                                                            if (!selectedReport) return;
                                                            try {
                                                                await reportsAPI.update(selectedReport.id, {
                                                                    streaming_config: streamingConfig
                                                                });
                                                                alert('Streaming configuration saved!');
                                                            } catch (err: any) {
                                                                alert(err.response?.data?.detail || 'Failed to save');
                                                            }
                                                        }}
                                                        className="btn btn-primary"
                                                    >
                                                        Save Streaming Config
                                                    </button>
                                                </div>

                                                {/* Info Note */}
                                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>⚡ How it works:</strong> Messages from the selected topic are buffered.
                                                        When trigger conditions are met, this report runs with the buffered data as input.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button onClick={closeEditModal} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCode}
                                disabled={updateMutation.isLoading}
                                className="btn btn-secondary"
                            >
                                {updateMutation.isLoading ? 'Saving...' : 'Save Draft'}
                            </button>
                            <button
                                onClick={handleExecute}
                                disabled={executing}
                                className="btn btn-success"
                            >
                                {executing ? (
                                    <span className="flex items-center gap-2">
                                        <div className="spinner"></div>
                                        Executing...
                                    </span>
                                ) : (
                                    <>
                                        <Icons.Play />
                                        <span className="ml-1">Execute Report</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && deletingReport && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Delete Report</h3>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600">
                                Are you sure you want to delete <strong>{deletingReport.name}</strong>?
                                This will also delete all versions and run history.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deletingReport.id)}
                                disabled={deleteMutation.isLoading}
                                className="btn btn-danger"
                            >
                                {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Execute Report Modal with Date Selection */}
            {showExecuteModal && executeReport && (
                <div className="modal-overlay" onClick={() => setShowExecuteModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Execute Report</h3>
                            <button onClick={() => setShowExecuteModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <p className="text-gray-600">
                                Execute <strong>{executeReport.name}</strong> with the following parameters:
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Business Date From</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={businessDateFrom}
                                        onChange={(e) => setBusinessDateFrom(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Business Date To</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={businessDateTo}
                                        onChange={(e) => setBusinessDateTo(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                                <strong>Tip:</strong> For a single day report, set both dates to the same value.
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowExecuteModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleExecute}
                                disabled={executing}
                                className="btn btn-success"
                            >
                                {executing ? (
                                    <span className="flex items-center gap-2">
                                        <div className="spinner"></div>
                                        Executing...
                                    </span>
                                ) : (
                                    <>
                                        <Icons.Play />
                                        <span className="ml-1">Execute Report</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Save Confirmation Modal */}
            {showSaveConfirm && (
                <div className="modal-overlay" onClick={() => setShowSaveConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Save Changes?</h3>
                            <button onClick={() => setShowSaveConfirm(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <p className="text-gray-600">
                                This will create a new version of <strong>{selectedReport?.name}</strong>.
                            </p>

                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Current Version:</span>
                                    <span className="badge badge-info">
                                        {currentVersion
                                            ? `v${currentVersion.major_version || 1}.${currentVersion.minor_version || 0}`
                                            : 'None (new report)'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-gray-600">New Version:</span>
                                    <span className="badge badge-success">
                                        {currentVersion
                                            ? `v${bumpMajor ? (currentVersion.major_version || 1) + 1 : (currentVersion.major_version || 1)}.${bumpMajor ? 0 : (currentVersion.minor_version || 0) + 1}`
                                            : 'v1.0'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="bumpMajor"
                                    checked={bumpMajor}
                                    onChange={(e) => setBumpMajor(e.target.checked)}
                                    className="rounded"
                                />
                                <label htmlFor="bumpMajor" className="text-sm text-amber-800">
                                    <strong>Major version bump</strong> — Use for breaking changes
                                </label>
                            </div>

                            <p className="text-sm text-gray-500">
                                Previous versions remain available in the version history.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowSaveConfirm(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSave}
                                disabled={createVersionMutation.isLoading}
                                className="btn btn-primary"
                            >
                                {createVersionMutation.isLoading ? 'Saving...' : `Save as ${currentVersion
                                    ? `v${bumpMajor ? (currentVersion.major_version || 1) + 1 : (currentVersion.major_version || 1)}.${bumpMajor ? 0 : (currentVersion.minor_version || 0) + 1}`
                                    : 'v1.0'
                                    }`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
