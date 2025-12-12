import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../services/api';
import { useState } from 'react';

interface ValidationException {
    id: string;
    job_run_id: string;
    validation_rule_id: string;
    validation_rule_name: string;
    row_number: number;
    original_data: Record<string, any>;
    amended_data: Record<string, any> | null;
    error_message: string;
    status: string;
    amended_by: string | null;
    amended_at: string | null;
    created_at: string;
    rejection_source?: string;
    rejection_code?: string;
}

// Icons
const Icons = {
    Refresh: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
    ),
    Edit: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    Warning: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
    ),
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'pending':
            return <span className="badge badge-warning">Pending</span>;
        case 'amended':
            return <span className="badge badge-info">Amended</span>;
        case 'resolved':
            return <span className="badge badge-success">Resolved</span>;
        case 'resubmitted':
            return <span className="badge" style={{ background: '#7c3aed', color: 'white' }}>Resubmitted</span>;
        case 'rejected':
            return <span className="badge badge-error">Rejected</span>;
        default:
            return <span className="badge badge-gray">{status}</span>;
    }
};

const getSourceBadge = (source?: string) => {
    switch (source) {
        case 'regulator_file':
            return <span className="badge badge-error">File Rejected</span>;
        case 'regulator_record':
            return <span className="badge badge-warning">Record Rejected</span>;
        case 'pre_validation':
        default:
            return <span className="badge badge-info">Pre-Validation</span>;
    }
};

export default function ExceptionsPage() {
    const queryClient = useQueryClient();
    const [filters, setFilters] = useState({
        status: '',
        source: '',
        business_date: ''
    });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, any>>({});

    // Helper to remove empty params
    const cleanParams = (params: Record<string, any>) => {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(params)) {
            if (value !== '' && value !== undefined && value !== null) {
                cleaned[key] = value;
            }
        }
        return cleaned;
    };

    // Build query string
    const buildQueryString = () => {
        const params = new URLSearchParams();
        params.append('limit', '100');
        if (filters.status) params.append('status', filters.status);
        if (filters.source) params.append('source', filters.source);
        if (filters.business_date) params.append('business_date', filters.business_date);
        return params.toString();
    };

    // Fetch exceptions
    const { data: exceptionsData, isLoading, refetch } = useQuery(
        ['exceptions', filters],
        () => api.get(`/exceptions?${buildQueryString()}`).then(res => res.data),
        { retry: false }
    );

    // Fetch stats
    const { data: stats } = useQuery(
        'exception-stats',
        () => api.get('/exceptions/stats').then(res => res.data)
    );

    const exceptions = exceptionsData?.exceptions || [];

    // Amend mutation
    const amendMutation = useMutation(
        ({ id, data }: { id: string; data: any }) =>
            api.put(`/exceptions/${id}/amend`, { amended_data: data }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('exceptions');
                queryClient.invalidateQueries('exception-stats');
                setEditingId(null);
                setEditData({});
            }
        }
    );

    // Resubmit mutation
    const resubmitMutation = useMutation(
        (ids: string[]) => api.post('/exceptions/resubmit', { exception_ids: ids }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('exceptions');
                queryClient.invalidateQueries('exception-stats');
                setSelectedIds(new Set());
            }
        }
    );

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const selectAll = () => {
        if (selectedIds.size === exceptions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(exceptions.map((e: ValidationException) => e.id)));
        }
    };

    const startEdit = (exception: ValidationException) => {
        setEditingId(exception.id);
        setEditData(exception.amended_data || exception.original_data);
    };

    const saveEdit = () => {
        if (editingId) {
            amendMutation.mutate({ id: editingId, data: editData });
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    const handleResubmit = () => {
        const resolvedIds = exceptions
            .filter((e: ValidationException) => selectedIds.has(e.id) && e.status === 'resolved')
            .map((e: ValidationException) => e.id);

        if (resolvedIds.length === 0) {
            alert('Only resolved exceptions can be resubmitted');
            return;
        }
        resubmitMutation.mutate(resolvedIds);
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="page-title">Exception Queue</h1>
                    <p className="page-description">
                        Review and amend validation exceptions
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleResubmit()}
                        className="btn btn-primary"
                        disabled={selectedIds.size === 0 || resubmitMutation.isLoading}
                    >
                        Resubmit Selected ({selectedIds.size})
                    </button>
                    <button onClick={() => refetch()} className="btn btn-secondary">
                        <Icons.Refresh />
                        <span className="ml-2">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="card p-4">
                        <p className="text-2xl font-bold text-gray-900">{stats.total_exceptions}</p>
                        <p className="text-sm text-gray-500">Total Exceptions</p>
                    </div>
                    <div className="card p-4 border-l-4 border-amber-500">
                        <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                        <p className="text-sm text-gray-500">Pending</p>
                    </div>
                    <div className="card p-4 border-l-4 border-sky-500">
                        <p className="text-2xl font-bold text-sky-600">{stats.amended}</p>
                        <p className="text-sm text-gray-500">Amended</p>
                    </div>
                    <div className="card p-4 border-l-4 border-emerald-500">
                        <p className="text-2xl font-bold text-emerald-600">{stats.resolved}</p>
                        <p className="text-sm text-gray-500">Resolved</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="input-label">Status</label>
                        <select
                            className="select text-sm"
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="amended">Amended</option>
                            <option value="resolved">Resolved</option>
                            <option value="resubmitted">Resubmitted</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    <div>
                        <label className="input-label">Source</label>
                        <select
                            className="select text-sm"
                            value={filters.source}
                            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                        >
                            <option value="">All Sources</option>
                            <option value="pre_validation">Pre-Validation</option>
                            <option value="regulator_file">Regulator File Rejection</option>
                            <option value="regulator_record">Regulator Record Rejection</option>
                        </select>
                    </div>

                    <div>
                        <label className="input-label">Business Date</label>
                        <input
                            type="date"
                            className="input text-sm"
                            value={filters.business_date}
                            onChange={(e) => setFilters({ ...filters, business_date: e.target.value })}
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={() => setFilters({ status: '', source: '', business_date: '' })}
                            className="btn btn-secondary text-sm"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Exceptions Table */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                    <p className="mt-3 text-sm text-gray-500">Loading exceptions...</p>
                </div>
            ) : exceptions.length > 0 ? (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === exceptions.length && exceptions.length > 0}
                                        onChange={selectAll}
                                    />
                                </th>
                                <th>Row #</th>
                                <th>Validation Rule</th>
                                <th>Source</th>
                                <th>Error Message</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exceptions.map((exception: ValidationException) => (
                                <tr key={exception.id} className={selectedIds.has(exception.id) ? 'bg-indigo-50' : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(exception.id)}
                                            onChange={() => toggleSelection(exception.id)}
                                        />
                                    </td>
                                    <td className="font-mono text-sm">{exception.row_number}</td>
                                    <td>
                                        <p className="font-medium text-gray-900">{exception.validation_rule_name}</p>
                                        {exception.rejection_code && (
                                            <p className="text-xs text-gray-500">Code: {exception.rejection_code}</p>
                                        )}
                                    </td>
                                    <td>{getSourceBadge(exception.rejection_source)}</td>
                                    <td className="max-w-xs">
                                        <p className="text-sm text-gray-700 truncate" title={exception.error_message}>
                                            {exception.error_message}
                                        </p>
                                    </td>
                                    <td>{getStatusBadge(exception.status)}</td>
                                    <td>
                                        {editingId === exception.id ? (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={saveEdit}
                                                    className="btn btn-primary btn-sm"
                                                    disabled={amendMutation.isLoading}
                                                >
                                                    <Icons.Check />
                                                </button>
                                                <button onClick={cancelEdit} className="btn btn-secondary btn-sm">
                                                    <Icons.Close />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(exception)}
                                                className="btn btn-secondary btn-sm"
                                                disabled={exception.status === 'resubmitted'}
                                            >
                                                <Icons.Edit />
                                                <span className="ml-1">Edit</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">
                    <div className="text-gray-300 mx-auto">
                        <Icons.Warning />
                    </div>
                    <h3 className="empty-state-title">No exceptions found</h3>
                    <p className="empty-state-description">
                        {filters.status || filters.source || filters.business_date
                            ? 'Try adjusting your filters'
                            : 'All validation rules are passing'}
                    </p>
                </div>
            )}

            {/* Edit Modal */}
            {editingId && (
                <div className="modal-overlay" onClick={cancelEdit}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Exception Data</h3>
                            <button onClick={cancelEdit} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="space-y-4">
                                {Object.entries(editData).map(([key, value]) => (
                                    <div key={key}>
                                        <label className="input-label">{key}</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={String(value || '')}
                                            onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={cancelEdit} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={saveEdit}
                                className="btn btn-primary"
                                disabled={amendMutation.isLoading}
                            >
                                {amendMutation.isLoading ? 'Saving...' : 'Save Amendment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
