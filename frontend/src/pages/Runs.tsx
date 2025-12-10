import { useQuery } from 'react-query';
import { runsAPI } from '../services/api';
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
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [selectedRun, setSelectedRun] = useState<Run | null>(null);
    const [filter, setFilter] = useState('all');

    const { data: runs, isLoading, refetch } = useQuery('runs', () =>
        runsAPI.list().then((res) => res.data)
    );

    const filteredRuns = runs?.filter((run: Run) => {
        if (filter === 'all') return true;
        return run.status === filter;
    });

    const getDuration = (run: Run) => {
        if (!run.started_at) return '-';
        const start = new Date(run.started_at);
        const end = run.ended_at ? new Date(run.ended_at) : new Date();
        const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    const viewLogs = (run: Run) => {
        setSelectedRun(run);
        setShowLogsModal(true);
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
            <div className="flex gap-2 mb-6">
                {['all', 'success', 'failed', 'running', 'pending'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filter === f
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Runs Table */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                    <p className="mt-3 text-sm text-gray-500">Loading runs...</p>
                </div>
            ) : filteredRuns && filteredRuns.length > 0 ? (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Run ID</th>
                                <th>Status</th>
                                <th>Triggered By</th>
                                <th>Started</th>
                                <th>Duration</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRuns.map((run: Run) => (
                                <tr key={run.id}>
                                    <td className="font-mono text-sm">{run.id.slice(0, 8)}...</td>
                                    <td>{getStatusBadge(run.status)}</td>
                                    <td className="capitalize">{run.triggered_by}</td>
                                    <td className="text-gray-500">
                                        {run.started_at
                                            ? new Date(run.started_at).toLocaleString()
                                            : new Date(run.created_at).toLocaleString()
                                        }
                                    </td>
                                    <td>{getDuration(run)}</td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => viewLogs(run)}
                                                className="btn btn-ghost btn-icon text-gray-600"
                                                title="View Logs"
                                            >
                                                <Icons.Eye />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-icon text-indigo-600"
                                                title="Download Artifacts"
                                            >
                                                <Icons.Download />
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-icon text-emerald-600"
                                                title="Re-run"
                                            >
                                                <Icons.Play />
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
                    <h3 className="empty-state-title">No runs yet</h3>
                    <p className="empty-state-description">
                        Execute a report to see runs here
                    </p>
                </div>
            )}

            {/* Logs Modal */}
            {showLogsModal && selectedRun && (
                <div className="modal-overlay" onClick={() => setShowLogsModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">Run Details</h3>
                                <p className="text-sm text-gray-500 mt-0.5 font-mono">
                                    {selectedRun.id}
                                </p>
                            </div>
                            <button onClick={() => setShowLogsModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <p className="text-sm text-gray-500">Status</p>
                                    <div className="mt-1">{getStatusBadge(selectedRun.status)}</div>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Triggered By</p>
                                    <p className="capitalize">{selectedRun.triggered_by}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Started</p>
                                    <p>{selectedRun.started_at ? new Date(selectedRun.started_at).toLocaleString() : '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Duration</p>
                                    <p>{getDuration(selectedRun)}</p>
                                </div>
                            </div>

                            {selectedRun.error_message && (
                                <div className="mb-6">
                                    <p className="text-sm text-gray-500 mb-2">Error Message</p>
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                                        {selectedRun.error_message}
                                    </div>
                                </div>
                            )}

                            <div>
                                <p className="text-sm text-gray-500 mb-2">Logs</p>
                                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 h-64 overflow-auto">
                                    <p className="text-gray-500"># Logs loading...</p>
                                    <p className="text-green-400">[INFO] Starting report execution</p>
                                    <p className="text-green-400">[INFO] Connecting to database...</p>
                                    <p className="text-green-400">[INFO] Executing query...</p>
                                    <p className="text-green-400">[INFO] Processing 1,234 rows</p>
                                    <p className="text-green-400">[INFO] Generating output file...</p>
                                    <p className="text-green-400">[INFO] Execution completed</p>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowLogsModal(false)} className="btn btn-secondary">
                                Close
                            </button>
                            <button className="btn btn-primary">
                                <Icons.Download />
                                <span className="ml-1">Download Artifacts</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
