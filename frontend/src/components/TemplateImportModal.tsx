import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { templatesAPI, connectorsAPI } from '../services/api';
import { useToast } from '../store/toastStore';
import { LoadingState } from './LoadingState';

interface TemplateImportModalProps {
    templateId: string;
    onClose: () => void;
    onSuccess: () => void;
}

interface Connector {
    id: string;
    name: string;
    type: string;
}

interface TableInfo {
    schema: string;
    name: string;
    full_name: string;
}

// Icons
const Icons = {
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
    ),
};

export default function TemplateImportModal({ templateId, onClose, onSuccess }: TemplateImportModalProps) {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [connectorId, setConnectorId] = useState('');
    const [sourceTable, setSourceTable] = useState('');

    // Fetch template details
    const { data: template, isLoading: templateLoading } = useQuery(
        ['template', templateId],
        () => templatesAPI.get(templateId).then(res => res.data)
    );

    // Fetch connectors
    const { data: connectors } = useQuery('connectors', () =>
        connectorsAPI.list().then(res => res.data)
    );

    // Fetch tables for selected connector
    const { data: tables } = useQuery(
        ['connector-tables', connectorId],
        () => connectorId ? connectorsAPI.getTables(connectorId).then(res => res.data.tables) : null,
        { enabled: !!connectorId }
    );

    // Pre-fill form when template loads
    useEffect(() => {
        if (template) {
            setName(template.name);
            setDescription(template.description);
        }
    }, [template]);

    // Import mutation
    const importMutation = useMutation(
        () => templatesAPI.import(templateId, {
            name: name || undefined,
            description: description || undefined,
            connector_id: connectorId || undefined,
            source_table: sourceTable || undefined
        }),
        {
            onSuccess: (response) => {
                queryClient.invalidateQueries('reports');
                showSuccess(`Report "${response.data.name}" created from template`);
                onSuccess();
            },
            onError: (error: any) => {
                showError(
                    'Import Failed',
                    error?.response?.data?.detail || 'Failed to import template'
                );
            }
        }
    );

    if (templateLoading) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="bg-white rounded-xl p-8" onClick={e => e.stopPropagation()}>
                    <LoadingState message="Loading template..." />
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Import Template</h2>
                        <p className="text-sm text-gray-500">
                            Create a new report from {template?.regulation} template
                        </p>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">
                        <Icons.Close />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                    {/* Template info banner */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="badge badge-info">{template?.regulation}</span>
                            <span className="text-sm text-gray-600">{template?.field_count} field mappings</span>
                        </div>
                        <p className="text-sm text-gray-700">{template?.description}</p>
                    </div>

                    {/* Report Name */}
                    <div>
                        <label className="input-label">Report Name</label>
                        <input
                            type="text"
                            className="input"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={template?.name}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Leave blank to use template name
                        </p>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="input-label">Description</label>
                        <textarea
                            className="input"
                            rows={2}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder={template?.description}
                        />
                    </div>

                    {/* Optional: Data Source */}
                    <div className="pt-4 border-t border-gray-100">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                            Data Source (Optional)
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <label className="input-label">Connector</label>
                                <select
                                    className="select"
                                    value={connectorId}
                                    onChange={e => {
                                        setConnectorId(e.target.value);
                                        setSourceTable('');
                                    }}
                                >
                                    <option value="">Select connector (optional)...</option>
                                    {connectors?.map((c: Connector) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {connectorId && tables && (
                                <div>
                                    <label className="input-label">Source Table</label>
                                    <select
                                        className="select"
                                        value={sourceTable}
                                        onChange={e => setSourceTable(e.target.value)}
                                    >
                                        <option value="">Select table...</option>
                                        {tables.map((t: TableInfo) => (
                                            <option key={t.full_name} value={t.full_name}>
                                                {t.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-gray-500 mt-2">
                            You can configure the data source later in report settings
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button onClick={onClose} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button
                        onClick={() => importMutation.mutate()}
                        disabled={importMutation.isLoading}
                        className="btn btn-primary"
                    >
                        {importMutation.isLoading ? (
                            'Importing...'
                        ) : (
                            <>
                                <Icons.Check />
                                <span className="ml-1">Import Template</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
