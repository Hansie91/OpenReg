import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './ExceptionsPage.css';

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
}

interface ExceptionStats {
    total_exceptions: number;
    pending: number;
    amended: number;
    resolved: number;
    rejected: number;
    by_report: Record<string, number>;
}

const ExceptionsPage: React.FC = () => {
    const [exceptions, setExceptions] = useState<ValidationException[]>([]);
    const [stats, setStats] = useState<ExceptionStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState<string>('pending');
    const [selectedExceptions, setSelectedExceptions] = useState<Set<string>>(new Set());
    const [editingException, setEditingException] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, any>>({});
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadExceptions();
        loadStats();
    }, [selectedStatus]);

    const loadExceptions = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/exceptions?status=${selectedStatus}&limit=100`);
            setExceptions(response.data.exceptions);
        } catch (error) {
            console.error('Failed to load exceptions:', error);
            showMessage('error', 'Failed to load exceptions');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await api.get('/exceptions/stats');
            setStats(response.data);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const startEditing = (exception: ValidationException) => {
        setEditingException(exception.id);
        setEditData(exception.amended_data || exception.original_data);
    };

    const cancelEditing = () => {
        setEditingException(null);
        setEditData({});
    };

    const saveAmendment = async (exceptionId: string) => {
        try {
            const response = await api.put(`/exceptions/${exceptionId}/amend`, {
                amended_data: editData
            });

            if (response.data.passes_validation) {
                showMessage('success', 'Amendment saved and validated successfully!');
            } else {
                showMessage('error', `Amendment saved but validation failed: ${response.data.message}`);
            }

            setEditingException(null);
            setEditData({});
            loadExceptions();
            loadStats();
        } catch (error: any) {
            console.error('Failed to save amendment:', error);
            showMessage('error', error.response?.data?.detail || 'Failed to save amendment');
        }
    };

    const toggleSelection = (exceptionId: string) => {
        const newSelected = new Set(selectedExceptions);
        if (newSelected.has(exceptionId)) {
            newSelected.delete(exceptionId);
        } else {
            newSelected.add(exceptionId);
        }
        setSelectedExceptions(newSelected);
    };

    const selectAll = () => {
        if (selectedExceptions.size === exceptions.length) {
            setSelectedExceptions(new Set());
        } else {
            setSelectedExceptions(new Set(exceptions.map(e => e.id)));
        }
    };

    const resubmitSelected = async () => {
        if (selectedExceptions.size === 0) {
            showMessage('error', 'No exceptions selected');
            return;
        }

        // Only resubmit resolved exceptions
        const resolvedIds = exceptions
            .filter(e => selectedExceptions.has(e.id) && e.status === 'resolved')
            .map(e => e.id);

        if (resolvedIds.length === 0) {
            showMessage('error', 'Only resolved exceptions can be resubmitted');
            return;
        }

        try {
            const response = await api.post('/exceptions/resubmit', {
                exception_ids: resolvedIds
            });

            showMessage('success', `Successfully resubmitted ${response.data.resubmitted_count} exceptions`);
            setSelectedExceptions(new Set());
            loadExceptions();
            loadStats();
        } catch (error: any) {
            console.error('Failed to resubmit:', error);
            showMessage('error', error.response?.data?.detail || 'Failed to resubmit exceptions');
        }
    };

    const getFieldsFromData = (data: Record<string, any>): string[] => {
        return Object.keys(data);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'pending': return 'badge-warning';
            case 'amended': return 'badge-info';
            case 'resolved': return 'badge-success';
            case 'resubmitted': return 'badge-primary';
            case 'rejected': return 'badge-danger';
            default: return 'badge-secondary';
        }
    };

    return (
        <div className="exceptions-page">
            <div className="page-header">
                <h1>Exception Queue</h1>
                <button
                    className="btn btn-primary"
                    onClick={resubmitSelected}
                    disabled={selectedExceptions.size === 0}
                >
                    Resubmit Selected ({selectedExceptions.size})
                </button>
            </div>

            {message && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            {stats && (
                <div className="stats-cards">
                    <div className="stat-card">
                        <div className="stat-value">{stats.total_exceptions}</div>
                        <div className="stat-label">Total Exceptions</div>
                    </div>
                    <div className="stat-card stat-warning">
                        <div className="stat-value">{stats.pending}</div>
                        <div className="stat-label">Pending</div>
                    </div>
                    <div className="stat-card stat-info">
                        <div className="stat-value">{stats.amended}</div>
                        <div className="stat-label">Amended</div>
                    </div>
                    <div className="stat-card stat-success">
                        <div className="stat-value">{stats.resolved}</div>
                        <div className="stat-label">Resolved</div>
                    </div>
                </div>
            )}

            <div className="filters">
                <label>
                    Status:
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="amended">Amended</option>
                        <option value="resolved">Resolved</option>
                        <option value="resubmitted">Resubmitted</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </label>
            </div>

            {loading ? (
                <div className="loading">Loading exceptions...</div>
            ) : exceptions.length === 0 ? (
                <div className="empty-state">
                    <p>No exceptions found</p>
                </div>
            ) : (
                <div className="exceptions-table-container">
                    <table className="exceptions-table">
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        checked={selectedExceptions.size === exceptions.length && exceptions.length > 0}
                                        onChange={selectAll}
                                    />
                                </th>
                                <th>Row #</th>
                                <th>Validation Rule</th>
                                <th>Error</th>
                                <th>Original Data</th>
                                <th>Amended Data</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exceptions.map((exception) => (
                                <tr key={exception.id} className={selectedExceptions.has(exception.id) ? 'selected' : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedExceptions.has(exception.id)}
                                            onChange={() => toggleSelection(exception.id)}
                                        />
                                    </td>
                                    <td>{exception.row_number}</td>
                                    <td>{exception.validation_rule_name}</td>
                                    <td className="error-cell">{exception.error_message}</td>
                                    <td>
                                        <div className="data-preview">
                                            {JSON.stringify(exception.original_data, null, 2)}
                                        </div>
                                    </td>
                                    <td>
                                        {editingException === exception.id ? (
                                            <div className="edit-form">
                                                {getFieldsFromData(editData).map((field) => (
                                                    <div key={field} className="form-group">
                                                        <label>{field}:</label>
                                                        <input
                                                            type="text"
                                                            value={editData[field] || ''}
                                                            onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                                                        />
                                                    </div>
                                                ))}
                                                <div className="edit-actions">
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        onClick={() => saveAmendment(exception.id)}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={cancelEditing}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : exception.amended_data ? (
                                            <div className="data-preview amended">
                                                {JSON.stringify(exception.amended_data, null, 2)}
                                            </div>
                                        ) : (
                                            <span className="text-muted">Not amended</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge ${getStatusBadgeClass(exception.status)}`}>
                                            {exception.status}
                                        </span>
                                    </td>
                                    <td>
                                        {editingException === exception.id ? null : (
                                            <button
                                                className="btn btn-sm btn-primary"
                                                onClick={() => startEditing(exception)}
                                                disabled={exception.status === 'resubmitted'}
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ExceptionsPage;
