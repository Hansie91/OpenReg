import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { validationsAPI } from '../services/api';

interface ValidationRule {
    id: string;
    name: string;
    description: string;
    rule_type: string;
    expression: string;
    severity: string;
    error_message: string;
    is_active: boolean;
    created_at: string;
}

// Icons
const Icons = {
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    Shield: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
    ),
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    Edit: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
    ),
    Trash: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
    ),
};

// Demo validation rules
const demoRules = [
    {
        id: '1',
        name: 'Non-null Transaction ID',
        description: 'Ensure transaction ID is never null',
        rule_type: 'sql',
        expression: 'transaction_id IS NOT NULL',
        severity: 'blocking',
        error_message: 'Transaction ID cannot be null',
        is_active: true,
    },
    {
        id: '2',
        name: 'Valid Price Range',
        description: 'Price must be positive',
        rule_type: 'sql',
        expression: 'price > 0',
        severity: 'blocking',
        error_message: 'Price must be greater than zero',
        is_active: true,
    },
    {
        id: '3',
        name: 'Future Date Warning',
        description: 'Warn if trade date is in the future',
        rule_type: 'sql',
        expression: "trade_date <= CURRENT_DATE",
        severity: 'warning',
        error_message: 'Trade date appears to be in the future',
        is_active: true,
    },
    {
        id: '4',
        name: 'Valid ISIN Format',
        description: 'ISIN must be 12 characters',
        rule_type: 'python_expr',
        expression: 'len(row["isin"]) == 12',
        severity: 'blocking',
        error_message: 'Invalid ISIN format',
        is_active: false,
    },
];

export default function Validations() {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        rule_type: 'sql',
        expression: '',
        severity: 'blocking',
        error_message: '',
    });

    const { data: rules, isLoading } = useQuery('validations', () =>
        validationsAPI.list().then((res) => res.data)
    );

    const displayRules = rules && rules.length > 0 ? rules : demoRules;

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="page-title">Validation Rules</h1>
                    <p className="page-description">
                        Define data quality checks for pre-generation and pre-delivery validation
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                    <Icons.Plus />
                    <span className="ml-2">Add Rule</span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="card p-5">
                    <p className="text-3xl font-bold text-gray-900">{displayRules.filter((r: any) => r.is_active).length}</p>
                    <p className="text-sm text-gray-500 mt-1">Active Rules</p>
                </div>
                <div className="card p-5">
                    <p className="text-3xl font-bold text-red-600">{displayRules.filter((r: any) => r.severity === 'blocking').length}</p>
                    <p className="text-sm text-gray-500 mt-1">Blocking Rules</p>
                </div>
                <div className="card p-5">
                    <p className="text-3xl font-bold text-amber-600">{displayRules.filter((r: any) => r.severity === 'warning').length}</p>
                    <p className="text-sm text-gray-500 mt-1">Warning Rules</p>
                </div>
            </div>

            {/* Rules Table */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Rule Name</th>
                                <th>Type</th>
                                <th>Severity</th>
                                <th>Expression</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayRules.map((rule: any) => (
                                <tr key={rule.id}>
                                    <td>
                                        <p className="font-medium text-gray-900">{rule.name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                                    </td>
                                    <td>
                                        <span className={`badge ${rule.rule_type === 'sql' ? 'badge-info' : 'badge-gray'}`}>
                                            {rule.rule_type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${rule.severity === 'blocking' ? 'badge-error' : 'badge-warning'}`}>
                                            {rule.severity.charAt(0).toUpperCase() + rule.severity.slice(1)}
                                        </span>
                                    </td>
                                    <td>
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                            {rule.expression.length > 40
                                                ? rule.expression.slice(0, 40) + '...'
                                                : rule.expression
                                            }
                                        </code>
                                    </td>
                                    <td>
                                        <span className={`badge ${rule.is_active ? 'badge-success' : 'badge-gray'}`}>
                                            {rule.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-1">
                                            <button className="btn btn-ghost btn-icon text-indigo-600">
                                                <Icons.Edit />
                                            </button>
                                            <button className="btn btn-ghost btn-icon text-red-600">
                                                <Icons.Trash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Validation Rule</h3>
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Rule Name *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Non-null Transaction ID"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Rule Type</label>
                                    <select
                                        className="select"
                                        value={formData.rule_type}
                                        onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                                    >
                                        <option value="sql">SQL Expression</option>
                                        <option value="python_expr">Python Expression</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="input-label">Description</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Ensure transaction ID is never null"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Expression *</label>
                                <textarea
                                    className="input font-mono text-sm"
                                    rows={3}
                                    placeholder={formData.rule_type === 'sql' ? "transaction_id IS NOT NULL AND price > 0" : "len(row['isin']) == 12"}
                                    value={formData.expression}
                                    onChange={(e) => setFormData({ ...formData, expression: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Severity</label>
                                    <select
                                        className="select"
                                        value={formData.severity}
                                        onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                                    >
                                        <option value="blocking">Blocking (stop execution)</option>
                                        <option value="warning">Warning (continue with alert)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label">Error Message *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Transaction ID cannot be null"
                                        value={formData.error_message}
                                        onChange={(e) => setFormData({ ...formData, error_message: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button className="btn btn-primary">
                                Create Rule
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
