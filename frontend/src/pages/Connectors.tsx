import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { connectorsAPI } from '../services/api';
import { validators } from '../hooks/useFormValidation';
import { FormError } from '../components/FormError';

// Database type options
const DB_TYPES = [
    { value: 'postgresql', label: 'PostgreSQL', icon: 'PG' },
    { value: 'sqlserver', label: 'SQL Server', icon: 'SQL' },
    { value: 'oracle', label: 'Oracle', icon: 'ORA' },
    { value: 'mysql', label: 'MySQL', icon: 'MY' },
    { value: 'odbc', label: 'ODBC', icon: 'ODBC' },
];

interface Connector {
    id: string;
    name: string;
    description: string;
    type: string;
    config: Record<string, any>;
    is_active: boolean;
    created_at: string;
}

interface ConnectorFormData {
    name: string;
    description: string;
    type: string;
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
}

interface FormErrors {
    name?: string | null;
    host?: string | null;
    port?: string | null;
    database?: string | null;
    username?: string | null;
    password?: string | null;
}

interface TouchedFields {
    name?: boolean;
    host?: boolean;
    port?: boolean;
    database?: boolean;
    username?: boolean;
    password?: boolean;
}

const initialFormData: ConnectorFormData = {
    name: '',
    description: '',
    type: 'postgresql',
    host: 'localhost',
    port: '5432',
    database: '',
    username: '',
    password: '',
};

const getDefaultPort = (type: string): string => {
    switch (type) {
        case 'postgresql': return '5432';
        case 'sqlserver': return '1433';
        case 'oracle': return '1521';
        case 'mysql': return '3306';
        default: return '';
    }
};

// Validation rules for connector form
const validationRules = {
    name: [
        validators.required('Connector name is required'),
        validators.minLength(3, 'Name must be at least 3 characters'),
        validators.maxLength(100, 'Name must be less than 100 characters'),
    ],
    host: [
        validators.required('Host is required'),
    ],
    port: [
        validators.required('Port is required'),
        validators.port('Please enter a valid port (1-65535)'),
    ],
    database: [
        validators.required('Database name is required'),
    ],
    username: [
        validators.required('Username is required'),
    ],
    password: [
        validators.required('Password is required'),
    ],
};

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
    Trash: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
    ),
    Test: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
        </svg>
    ),
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    Database: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
    ),
};

export default function Connectors() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editingConnector, setEditingConnector] = useState<Connector | null>(null);
    const [deletingConnector, setDeletingConnector] = useState<Connector | null>(null);
    const [formData, setFormData] = useState<ConnectorFormData>(initialFormData);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [testLoading, setTestLoading] = useState(false);

    // Form validation state
    const [errors, setErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<TouchedFields>({});

    const { data: connectors, isLoading } = useQuery('connectors', () =>
        connectorsAPI.list().then((res) => res.data)
    );

    // Validate a single field
    const validateField = useCallback((name: keyof FormErrors, value: string, isEditing: boolean): string | null => {
        // Password is optional when editing
        if (name === 'password' && isEditing) {
            return null;
        }

        const rules = validationRules[name as keyof typeof validationRules];
        if (!rules) return null;

        for (const rule of rules) {
            if (!rule.validate(value)) {
                return rule.message;
            }
        }
        return null;
    }, []);

    // Validate all fields
    const validateAll = useCallback((isEditing: boolean): boolean => {
        const newErrors: FormErrors = {};
        let isValid = true;

        const fieldsToValidate: (keyof FormErrors)[] = ['name', 'host', 'port', 'database', 'username'];
        if (!isEditing) {
            fieldsToValidate.push('password');
        }

        for (const field of fieldsToValidate) {
            const error = validateField(field, formData[field] || '', isEditing);
            newErrors[field] = error;
            if (error) isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    }, [formData, validateField]);

    // Handle field blur
    const handleBlur = useCallback((name: keyof FormErrors) => () => {
        setTouched((prev) => ({ ...prev, [name]: true }));
        const error = validateField(name, formData[name] || '', !!editingConnector);
        setErrors((prev) => ({ ...prev, [name]: error }));
    }, [formData, validateField, editingConnector]);

    // Handle field change with validation
    const handleFieldChange = useCallback((name: keyof ConnectorFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));

        // Validate on change if field was touched
        if (touched[name as keyof TouchedFields]) {
            const error = validateField(name as keyof FormErrors, value, !!editingConnector);
            setErrors((prev) => ({ ...prev, [name]: error }));
        }
    }, [touched, validateField, editingConnector]);

    // Check if form has errors
    const hasErrors = Object.values(errors).some((error) => error !== null && error !== undefined);

    // Reset validation state when modal opens/closes
    useEffect(() => {
        if (!showModal) {
            setErrors({});
            setTouched({});
        }
    }, [showModal]);

    const createMutation = useMutation(
        (data: any) => connectorsAPI.create(data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('connectors');
                closeModal();
            },
        }
    );

    const updateMutation = useMutation(
        ({ id, data }: { id: string; data: any }) => connectorsAPI.update(id, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('connectors');
                closeModal();
            },
        }
    );

    const deleteMutation = useMutation(
        (id: string) => connectorsAPI.delete(id),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('connectors');
                setShowDeleteModal(false);
                setDeletingConnector(null);
            },
        }
    );

    const closeModal = () => {
        setShowModal(false);
        setEditingConnector(null);
        setFormData(initialFormData);
        setTestResult(null);
        setErrors({});
        setTouched({});
    };

    const openCreateModal = () => {
        setFormData(initialFormData);
        setEditingConnector(null);
        setTestResult(null);
        setErrors({});
        setTouched({});
        setShowModal(true);
    };

    const openEditModal = (connector: Connector) => {
        setEditingConnector(connector);
        setFormData({
            name: connector.name,
            description: connector.description || '',
            type: connector.type,
            host: connector.config?.host || '',
            port: connector.config?.port || '',
            database: connector.config?.database || '',
            username: connector.config?.username || '',
            password: '', // Don't show password
        });
        setTestResult(null);
        setErrors({});
        setTouched({});
        setShowModal(true);
    };

    const handleTypeChange = (type: string) => {
        setFormData({
            ...formData,
            type,
            port: getDefaultPort(type),
        });
    };

    const handleTestConnection = async () => {
        setTestLoading(true);
        setTestResult(null);
        try {
            const result = await connectorsAPI.test({
                type: formData.type,
                config: {
                    host: formData.host,
                    port: parseInt(formData.port) || 5432,
                    database: formData.database,
                },
                credentials: {
                    username: formData.username,
                    password: formData.password,
                }
            });
            // Check if the API returned an error status
            if (result.data?.status === 'error') {
                setTestResult({ success: false, message: result.data.message || 'Connection failed' });
            } else {
                setTestResult({ success: true, message: 'Connection successful!' });
            }
        } catch (err: any) {
            setTestResult({
                success: false,
                message: err.response?.data?.detail || err.response?.data?.message || 'Connection failed',
            });
        } finally {
            setTestLoading(false);
        }
    };

    const handleSubmit = () => {
        // Mark all fields as touched
        const allTouched: TouchedFields = {
            name: true,
            host: true,
            port: true,
            database: true,
            username: true,
            password: true,
        };
        setTouched(allTouched);

        // Validate all fields
        if (!validateAll(!!editingConnector)) {
            return;
        }

        const payload = {
            name: formData.name,
            description: formData.description,
            type: formData.type,
            config: {
                host: formData.host,
                port: parseInt(formData.port) || 5432,
                database: formData.database,
            },
            credentials: {
                username: formData.username,
                password: formData.password,
            },
        };

        if (editingConnector) {
            updateMutation.mutate({ id: editingConnector.id, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const getDbIcon = (type: string) => {
        const db = DB_TYPES.find(d => d.value === type);
        return db?.icon || 'DB';
    };

    const isSaving = createMutation.isLoading || updateMutation.isLoading;

    // Helper to get input class with error state
    const getInputClass = (fieldName: keyof FormErrors) => {
        const hasError = touched[fieldName] && errors[fieldName];
        return `input ${hasError ? 'input-error' : ''}`;
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="page-title">Database Connectors</h1>
                    <p className="page-description">
                        Manage connections to your data sources
                    </p>
                </div>
                <button onClick={openCreateModal} className="btn btn-primary">
                    <Icons.Plus />
                    <span className="ml-2">Add Connector</span>
                </button>
            </div>

            {/* Connectors Grid */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                    <p className="mt-3 text-sm text-gray-500">Loading connectors...</p>
                </div>
            ) : connectors && connectors.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {connectors.map((connector: Connector) => (
                        <div key={connector.id} className="card group">
                            <div className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{getDbIcon(connector.type)}</span>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{connector.name}</h3>
                                            <span className="badge badge-info mt-1">{connector.type}</span>
                                        </div>
                                    </div>
                                    <span className={`badge ${connector.is_active ? 'badge-success' : 'badge-gray'}`}>
                                        {connector.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <p className="mt-4 text-sm text-gray-500 line-clamp-2">
                                    {connector.description || 'No description'}
                                </p>
                                {connector.config?.host && (
                                    <p className="mt-2 text-xs text-gray-400 font-mono">
                                        {connector.config.host}:{connector.config.port}/{connector.config.database}
                                    </p>
                                )}
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                                <button
                                    onClick={() => openEditModal(connector)}
                                    className="btn btn-ghost text-sm flex-1"
                                >
                                    <Icons.Edit />
                                    <span className="ml-1">Edit</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setDeletingConnector(connector);
                                        setShowDeleteModal(true);
                                    }}
                                    className="btn btn-ghost text-red-600 hover:bg-red-50 text-sm"
                                >
                                    <Icons.Trash />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="text-gray-300">
                        <Icons.Database />
                    </div>
                    <h3 className="empty-state-title">No connectors yet</h3>
                    <p className="empty-state-description">
                        Add a database connector to start creating reports
                    </p>
                    <button onClick={openCreateModal} className="btn btn-primary mt-4">
                        <Icons.Plus />
                        <span className="ml-2">Add Connector</span>
                    </button>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingConnector ? 'Edit Connector' : 'Add New Connector'}
                            </h3>
                            <button onClick={closeModal} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-5">
                            {/* Database Type Selection */}
                            <div>
                                <label className="input-label">Database Type</label>
                                <div className="grid grid-cols-5 gap-2 mt-2">
                                    {DB_TYPES.map((db) => (
                                        <button
                                            key={db.value}
                                            type="button"
                                            onClick={() => handleTypeChange(db.value)}
                                            className={`p-3 rounded-lg border-2 transition-all text-center ${formData.type === db.value
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <span className="text-2xl">{db.icon}</span>
                                            <p className="text-xs font-medium mt-1 text-gray-700">{db.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-field">
                                    <label className="input-label">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className={getInputClass('name')}
                                        placeholder="Production DB"
                                        value={formData.name}
                                        onChange={(e) => handleFieldChange('name', e.target.value)}
                                        onBlur={handleBlur('name')}
                                        aria-invalid={!!errors.name}
                                    />
                                    {touched.name && <FormError error={errors.name} />}
                                </div>
                                <div>
                                    <label className="input-label">Description</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Main reporting database"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-5">
                                <h4 className="text-sm font-medium text-gray-700 mb-4">Connection Details</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2 form-field">
                                        <label className="input-label">
                                            Host <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className={getInputClass('host')}
                                            placeholder="localhost"
                                            value={formData.host}
                                            onChange={(e) => handleFieldChange('host', e.target.value)}
                                            onBlur={handleBlur('host')}
                                            aria-invalid={!!errors.host}
                                        />
                                        {touched.host && <FormError error={errors.host} />}
                                    </div>
                                    <div className="form-field">
                                        <label className="input-label">
                                            Port <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className={getInputClass('port')}
                                            placeholder={getDefaultPort(formData.type)}
                                            value={formData.port}
                                            onChange={(e) => handleFieldChange('port', e.target.value)}
                                            onBlur={handleBlur('port')}
                                            aria-invalid={!!errors.port}
                                        />
                                        {touched.port && <FormError error={errors.port} />}
                                    </div>
                                </div>
                                <div className="mt-4 form-field">
                                    <label className="input-label">
                                        Database Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className={getInputClass('database')}
                                        placeholder="mydb"
                                        value={formData.database}
                                        onChange={(e) => handleFieldChange('database', e.target.value)}
                                        onBlur={handleBlur('database')}
                                        aria-invalid={!!errors.database}
                                    />
                                    {touched.database && <FormError error={errors.database} />}
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="form-field">
                                        <label className="input-label">
                                            Username <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className={getInputClass('username')}
                                            placeholder="admin"
                                            value={formData.username}
                                            onChange={(e) => handleFieldChange('username', e.target.value)}
                                            onBlur={handleBlur('username')}
                                            aria-invalid={!!errors.username}
                                        />
                                        {touched.username && <FormError error={errors.username} />}
                                    </div>
                                    <div className="form-field">
                                        <label className="input-label">
                                            Password {editingConnector ? '(leave blank to keep)' : <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="password"
                                            className={!editingConnector ? getInputClass('password') : 'input'}
                                            placeholder="********"
                                            value={formData.password}
                                            onChange={(e) => handleFieldChange('password', e.target.value)}
                                            onBlur={!editingConnector ? handleBlur('password') : undefined}
                                            aria-invalid={!editingConnector && !!errors.password}
                                        />
                                        {!editingConnector && touched.password && <FormError error={errors.password} />}
                                    </div>
                                </div>
                            </div>

                            {/* Test Connection Result */}
                            {testResult && (
                                <div className={`p-4 rounded-lg ${testResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                                    <div className="flex items-center gap-2">
                                        {testResult.success ? <Icons.Check /> : <Icons.Close />}
                                        <span className="font-medium">{testResult.message}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                onClick={handleTestConnection}
                                disabled={testLoading || !formData.host || !formData.database}
                                className="btn btn-secondary"
                            >
                                {testLoading ? (
                                    <span className="flex items-center gap-2">
                                        <div className="spinner"></div>
                                        Testing...
                                    </span>
                                ) : (
                                    <>
                                        <Icons.Test />
                                        <span className="ml-1">Test Connection</span>
                                    </>
                                )}
                            </button>
                            <div className="flex-1"></div>
                            <button onClick={closeModal} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSaving || hasErrors}
                                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <span className="flex items-center gap-2">
                                        <div className="spinner"></div>
                                        Saving...
                                    </span>
                                ) : (
                                    editingConnector ? 'Update Connector' : 'Create Connector'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && deletingConnector && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Delete Connector</h3>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600">
                                Are you sure you want to delete <strong>{deletingConnector.name}</strong>?
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deletingConnector.id)}
                                disabled={deleteMutation.isLoading}
                                className="btn btn-danger"
                            >
                                {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
