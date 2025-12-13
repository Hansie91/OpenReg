import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { reportsAPI, connectorsAPI } from '../services/api';
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
    version_number: number;
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
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [deletingReport, setDeletingReport] = useState<Report | null>(null);
    const [editorTab, setEditorTab] = useState<'code' | 'history'>('code');

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

        // Load saved code from version if available
        if (report.current_version_id) {
            try {
                const versionsRes = await reportsAPI.getVersions(report.id);
                const versions = versionsRes.data;
                if (versions && versions.length > 0) {
                    // Find the current version
                    const currentVersion = versions.find((v: ReportVersion) => v.id === report.current_version_id) || versions[0];
                    setPythonCode(currentVersion.python_code || DEFAULT_CODE);
                    if (currentVersion.connector_id) {
                        setConnectorId(currentVersion.connector_id);
                    }
                    return;
                }
            } catch (err) {
                console.error('Failed to load report version:', err);
            }
        }
        setPythonCode(DEFAULT_CODE);
    };

    const handleCreate = () => {
        createMutation.mutate({ name, description });
    };

    const handleSaveCode = () => {
        if (!selectedReport) return;

        updateMutation.mutate({
            id: selectedReport.id,
            data: {
                python_code: pythonCode,
                connector_id: connectorId || null,
            },
        });
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
                                        {report.current_version_id ? (
                                            <span className="badge badge-info">v1</span>
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
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
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
                            <button onClick={closeEditModal} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
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
                                onClick={() => setEditorTab('history')}
                                className={`px-4 py-2.5 text-sm font-medium transition-all ${editorTab === 'history'
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Execution History
                            </button>
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
                                            onChange={(value) => setPythonCode(value || '')}
                                            theme="vs-light"
                                            options={{
                                                minimap: { enabled: false },
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

                                            <div>
                                                <label className="input-label">Output Format</label>
                                                <select className="select" defaultValue="csv">
                                                    <option value="csv">CSV</option>
                                                    <option value="xml">XML</option>
                                                    <option value="json">JSON</option>
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

                            {/* History Tab */}
                            {editorTab === 'history' && (
                                <div className="flex-1 p-6 overflow-y-auto">
                                    {/* Statistics Cards */}
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
                                        <div className="text-center py-12 text-gray-500">
                                            <p>No executions yet</p>
                                            <p className="text-sm mt-1">Execute this report to see history</p>
                                        </div>
                                    )}
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
        </div>
    );
}
