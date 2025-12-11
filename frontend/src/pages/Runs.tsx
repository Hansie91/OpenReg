import { useQuery } from 'react-query';
import { runsAPI, reportsAPI } from '../services/api';
import { useState } from 'react';

interface Run {
    id: string;
    report_version_id: string;
    triggered_by: string;
    status: string;
    parameters: Record<string, any>;
    started_at: string | null;
    ended_at: string | null;
    error_message: string | null;
    created_at: string;
}

// Icons
const Icons = {
    Refresh: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
    ),
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
    ),
    Eye: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
    ),
    Play: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
        </svg>
    ),
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    Document: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
    ),
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'success':
            return <span className="badge badge-success">Success</span>;
        case 'failed':
            return <span className="badge badge-error">Failed</span>;
        case 'running':
            return <span className="badge badge-info flex items-center gap-1"><div className="spinner w-3 h-3"></div>Running</span>;
        case 'pending':
            return <span className="badge badge-gray">Pending</span>;
        case 'partial':
            return <span className="badge badge-warning">Partial</span>;
        default:
            return <span className="badge badge-gray">{status}</span>;
    }
};

export default function Runs() {
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        status: '',
        report_id: '',
        skip: 0,
        limit: 50
    });

    // Fetch runs with filters
    const { data: runsData, isLoading, refetch } = useQuery(
        ['runs', filters],
        () => runsAPI.list(filters).then((res) => res.data)
    );

    // Fetch reports for filter dropdown
    const { data: reports } = useQuery('reports', () =>
        reportsAPI.list().then((res) => res.data)
    );

    // Fetch detailed run information when modal is open
    const { data: runDetails } = useQuery(
        ['run-details', selectedRunId],
        () => selectedRunId ? runsAPI.getDetails(selectedRunId).then((res) => res.data) : null,
        { enabled: !!selectedRunId }
    );

    const runs = runsData?.data || [];

    const getDuration = (run: Run) => {
        if (!run.started_at) return '-';
        const start = new Date(run.started_at);
        const end = run.ended_at ? new Date(run.ended_at) : new Date();
        const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    const viewDetails = (runId: string) => {
        setSelectedRunId(runId);
        setShowDetailsModal(true);
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="page-title">Job Runs</h1>
                    <p className="page-description">
                        Monitor report execution history and download artifacts
                    </p>
                </div>
                <button onClick={() => refetch()} className="btn btn-secondary">
                    <Icons.Refresh />
                    <span className="ml-2">Refresh</span>
                </button>
            </div>

            {/* Filters */}
            <div className="card p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="input-label">Report</label>
                        <select
                            className="select text-sm"
                            value={filters.report_id}
                            onChange={(e) => setFilters({ ...filters, report_id: e.target.value, skip: 0 })}
                        >
                            <option value="">All Reports</option>
                            {reports?.map((r: any) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="input-label">Status</label>
                        <select
                            className="select text-sm"
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value, skip: 0 })}
                        >
                            <option value="">All Statuses</option>
                            <option value="success">Success</option>
                            <option value="failed">Failed</option>
                            <option value="running">Running</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>

                    <div>
                        <label className="input-label">Results</label>
                        <select
                            className="select text-sm"
                            value={filters.limit}
                            onChange={(e) => setFilters({ ...filters, limit: Number(e.target.value), skip: 0 })}
                        >
                            <option value="25">25 per page</option>
                            <option value="50">50 per page</option>
                            <option value="100">100 per page</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Runs Table */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                    <p className="mt-3 text-sm text-gray-500">Loading runs...</p>
                </div>
            ) : runs && runs.length > 0 ? (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Report</th>
                                <th>Status</th>
                                <th>Triggered By</th>
                                <th>Started</th>
                                <th>Duration</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((run: any) => (
                                <tr key={run.id}>
                                    <td>
                                        <p className="font-medium text-gray-900">{run.report_name}</p>
                                        <p className="text-xs text-gray-500 font-mono">{run.id.slice(0, 8)}...</p>
                                    </td>
                                    <td>{getStatusBadge(run.status)}</td>
                                    <td className="capitalize">{run.triggered_by}</td>
                                    <td className="text-gray-500 text-sm">
                                        {run.started_at
                                            ? new Date(run.started_at).toLocaleString()
                                            : new Date(run.created_at).toLocaleString()
                                        }
                                    </td>
                                    <td className="text-gray-600">
                                        {run.started_at && run.ended_at
                                            ? `${((new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
                                            : '—'
                                        }
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => viewDetails(run.id)}
                                            className="btn btn-secondary btn-sm"
                                            title="View Details"
                                        >
                                            <Icons.Eye />
                                            <span className="ml-1.5">Details</span>
                                        </button>
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
                    <h3 className="empty-state-title">No runs yet</h3>
                    <p className="empty-state-description">
                        Execute a report to see runs here
                    </p>
                </div>
            )}

            {/* Run Details Modal */}
            {showDetailsModal && selectedRunId && runDetails && (
                <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
                    <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">{runDetails.report?.name || 'Run Details'}</h3>
                                <p className="text-sm text-gray-500 mt-0.5 font-mono">
                                    Run ID: {selectedRunId.slice(0, 16)}...
                                </p>
                            </div>
                            <button onClick={() => setShowDetailsModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>

                        <div className="modal-body space-y-6">
                            {/* Execution Timeline */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Execution Timeline</h4>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="card p-3">
                                        <p className="text-xs text-gray-500">Status</p>
                                        <div className="mt-1">{getStatusBadge(runDetails.status)}</div>
                                    </div>
                                    <div className="card p-3">
                                        <p className="text-xs text-gray-500">Triggered By</p>
                                        <p className="text-sm font-medium capitalize">{runDetails.triggered_by}</p>
                                    </div>
                                    <div className="card p-3">
                                        <p className="text-xs text-gray-500">Duration</p>
                                        <p className="text-sm font-medium">
                                            {runDetails.timeline?.duration_seconds
                                                ? `${runDetails.timeline.duration_seconds.toFixed(1)}s`
                                                : '—'
                                            }
                                        </p>
                                    </div>
                                    <div className="card p-3">
                                        <p className="text-xs text-gray-500">Created</p>
                                        <p className="text-sm font-medium">
                                            {new Date(runDetails.timeline.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Validation Results */}
                            {runDetails.validation_results && runDetails.validation_results.total > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Validation Results</h4>
                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        <div className="card p-3">
                                            <p className="text-xs text-gray-500">Total Rules</p>
                                            <p className="text-xl font-bold text-gray-900">
                                                {runDetails.validation_results.total}
                                            </p>
                                        </div>
                                        <div className="card p-3">
                                            <p className="text-xs text-gray-500">Passed</p>
                                            <p className="text-xl font-bold text-emerald-600">
                                                {runDetails.validation_results.passed}
                                            </p>
                                        </div>
                                        <div className="card p-3">
                                            <p className="text-xs text-gray-500">Failed</p>
                                            <p className="text-xl font-bold text-red-600">
                                                {runDetails.validation_results.failed}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Artifacts */}
                            {runDetails.artifacts && runDetails.artifacts.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Artifacts</h4>
                                    <div className="space-y-2">
                                        {runDetails.artifacts.map((artifact: any) => (
                                            <div key={artifact.id} className="card p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="text-indigo-600">
                                                        <Icons.Document />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{artifact.filename}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {artifact.mime_type} • {(artifact.size_bytes / 1024).toFixed(1)} KB
                                                        </p>
                                                    </div>
                                                </div>
                                                <button className="btn btn-secondary btn-sm">
                                                    <Icons.Download />
                                                    <span className="ml-1.5">Download</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {runDetails.error_message && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Error Details</h4>
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                                        {runDetails.error_message}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button onClick={() => setShowDetailsModal(false)} className="btn btn-secondary">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
