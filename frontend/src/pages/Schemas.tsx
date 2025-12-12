import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { schemasAPI } from '../services/api';

interface Schema {
    id: string;
    name: string;
    description: string | null;
    version: string | null;
    root_element: string | null;
    namespace: string | null;
    element_count: number;
    is_active: boolean;
    created_at: string;
}

interface SchemaElement {
    name: string;
    xpath: string;
    type: string;
    required: boolean;
    min_occurs: number;
    max_occurs: number;
    documentation: string;
    enumerations: string[];
    is_repeating: boolean;
}

// Icons
const Icons = {
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    Upload: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
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
    Eye: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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

export default function Schemas() {
    const queryClient = useQueryClient();
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);
    const [deletingSchema, setDeletingSchema] = useState<Schema | null>(null);

    // Upload form state
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [schemaName, setSchemaName] = useState('');
    const [schemaDescription, setSchemaDescription] = useState('');
    const [schemaVersion, setSchemaVersion] = useState('');
    const [uploadPreview, setUploadPreview] = useState<any>(null);
    const [uploadError, setUploadError] = useState('');

    // Fetch schemas
    const { data: schemas, isLoading } = useQuery('schemas', () =>
        schemasAPI.list().then(res => res.data.schemas)
    );

    // Fetch elements for selected schema
    const { data: schemaElements } = useQuery(
        ['schema-elements', selectedSchema?.id],
        () => selectedSchema ? schemasAPI.getElements(selectedSchema.id).then(res => res.data.elements) : null,
        { enabled: !!selectedSchema }
    );

    // Mutations
    const uploadMutation = useMutation(
        () => {
            if (!uploadFile) throw new Error('No file selected');
            return schemasAPI.upload(uploadFile, schemaName, schemaDescription || undefined, schemaVersion || undefined);
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries('schemas');
                closeUploadModal();
            },
            onError: (err: any) => {
                setUploadError(err.response?.data?.detail || 'Upload failed');
            }
        }
    );

    const deleteMutation = useMutation(
        (id: string) => schemasAPI.delete(id),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('schemas');
                setShowDeleteModal(false);
                setDeletingSchema(null);
            }
        }
    );

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadFile(file);
        setUploadError('');

        // Auto-fill name from filename
        const baseName = file.name.replace('.xsd', '');
        if (!schemaName) {
            setSchemaName(baseName);
        }

        // Preview the schema
        try {
            const res = await schemasAPI.parsePreview(file);
            setUploadPreview(res.data);
            if (!res.data.valid) {
                setUploadError(res.data.error || 'Invalid XSD file');
            }
        } catch (err: any) {
            setUploadError(err.response?.data?.detail || 'Failed to parse XSD');
            setUploadPreview(null);
        }
    };

    const closeUploadModal = () => {
        setShowUploadModal(false);
        setUploadFile(null);
        setSchemaName('');
        setSchemaDescription('');
        setSchemaVersion('');
        setUploadPreview(null);
        setUploadError('');
    };

    const openPreview = (schema: Schema) => {
        setSelectedSchema(schema);
        setShowPreviewModal(true);
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="page-title">XML Schemas</h1>
                    <p className="page-description">
                        Manage XSD schemas for declarative report generation
                    </p>
                </div>
                <button onClick={() => setShowUploadModal(true)} className="btn btn-primary">
                    <Icons.Upload />
                    <span className="ml-2">Upload Schema</span>
                </button>
            </div>

            {/* Schemas Grid/Table */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                    <p className="mt-3 text-sm text-gray-500">Loading schemas...</p>
                </div>
            ) : schemas && schemas.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {schemas.map((schema: Schema) => (
                        <div key={schema.id} className="card p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                        <Icons.Code />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{schema.name}</h3>
                                        {schema.version && (
                                            <span className="badge badge-info text-xs">{schema.version}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {schema.description && (
                                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                    {schema.description}
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Root Element</span>
                                    <p className="font-mono text-gray-900">{schema.root_element || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500">Elements</span>
                                    <p className="font-semibold text-gray-900">{schema.element_count}</p>
                                </div>
                            </div>

                            {schema.namespace && (
                                <div className="text-xs text-gray-400 font-mono truncate mb-4" title={schema.namespace}>
                                    {schema.namespace}
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => openPreview(schema)}
                                    className="btn btn-secondary btn-sm flex-1"
                                >
                                    <Icons.Eye />
                                    <span className="ml-1">View Elements</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setDeletingSchema(schema);
                                        setShowDeleteModal(true);
                                    }}
                                    className="btn btn-ghost btn-icon text-red-600"
                                    title="Delete"
                                >
                                    <Icons.Trash />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="text-gray-300 mx-auto">
                        <Icons.Document />
                    </div>
                    <h3 className="empty-state-title">No schemas uploaded yet</h3>
                    <p className="empty-state-description">
                        Upload an XSD schema to enable declarative report creation
                    </p>
                    <button onClick={() => setShowUploadModal(true)} className="btn btn-primary mt-4">
                        <Icons.Upload />
                        <span className="ml-2">Upload Schema</span>
                    </button>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={closeUploadModal}>
                    <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Upload XSD Schema</h3>
                            <button onClick={closeUploadModal} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            {/* File Upload */}
                            <div>
                                <label className="input-label">XSD File *</label>
                                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-indigo-300 transition-colors">
                                    <input
                                        type="file"
                                        accept=".xsd"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="xsd-upload"
                                    />
                                    <label htmlFor="xsd-upload" className="cursor-pointer">
                                        {uploadFile ? (
                                            <div className="flex items-center justify-center gap-2 text-indigo-600">
                                                <Icons.Document />
                                                <span className="font-medium">{uploadFile.name}</span>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500">
                                                <Icons.Upload />
                                                <p className="mt-2">Click to select an XSD file</p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>

                            {/* Upload Preview */}
                            {uploadPreview && uploadPreview.valid && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <h4 className="font-medium text-green-800 mb-2">✓ Valid XSD Schema</h4>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="text-green-600">Root Element</span>
                                            <p className="font-mono text-green-900">{uploadPreview.root_element}</p>
                                        </div>
                                        <div>
                                            <span className="text-green-600">Elements</span>
                                            <p className="font-semibold text-green-900">{uploadPreview.element_count}</p>
                                        </div>
                                        <div>
                                            <span className="text-green-600">Namespace</span>
                                            <p className="font-mono text-green-900 truncate text-xs" title={uploadPreview.namespace}>
                                                {uploadPreview.namespace || 'None'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {uploadError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                                    {uploadError}
                                </div>
                            )}

                            {/* Schema Info */}
                            <div>
                                <label className="input-label">Schema Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="MiFIR RTS25"
                                    value={schemaName}
                                    onChange={e => setSchemaName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    placeholder="Transaction reporting schema for MiFIR compliance"
                                    value={schemaDescription}
                                    onChange={e => setSchemaDescription(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="input-label">Version</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="1.2.0"
                                    value={schemaVersion}
                                    onChange={e => setSchemaVersion(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={closeUploadModal} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => uploadMutation.mutate()}
                                disabled={!uploadFile || !schemaName || !uploadPreview?.valid || uploadMutation.isLoading}
                                className="btn btn-primary"
                            >
                                {uploadMutation.isLoading ? 'Uploading...' : 'Upload Schema'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Schema Preview Modal */}
            {showPreviewModal && selectedSchema && (
                <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div>
                                <h3 className="modal-title">{selectedSchema.name}</h3>
                                <p className="text-sm text-gray-500">
                                    {selectedSchema.element_count} elements
                                    {selectedSchema.namespace && ` • ${selectedSchema.namespace}`}
                                </p>
                            </div>
                            <button onClick={() => setShowPreviewModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            {schemaElements ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider pb-2 border-b">
                                        <div className="col-span-5">XPath</div>
                                        <div className="col-span-2">Type</div>
                                        <div className="col-span-1">Required</div>
                                        <div className="col-span-4">Documentation</div>
                                    </div>
                                    {schemaElements.map((elem: SchemaElement, i: number) => (
                                        <div key={i} className="grid grid-cols-12 gap-2 py-2 text-sm border-b border-gray-50 hover:bg-gray-50">
                                            <div className="col-span-5 font-mono text-indigo-600 truncate" title={elem.xpath}>
                                                {elem.xpath}
                                            </div>
                                            <div className="col-span-2">
                                                <span className="badge badge-gray">{elem.type}</span>
                                            </div>
                                            <div className="col-span-1">
                                                {elem.required ? (
                                                    <span className="text-red-500">✓</span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </div>
                                            <div className="col-span-4 text-gray-500 truncate" title={elem.documentation}>
                                                {elem.documentation || '-'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="spinner mx-auto text-indigo-600"></div>
                                    <p className="mt-3 text-sm text-gray-500">Loading elements...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && deletingSchema && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Delete Schema</h3>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600">
                                Are you sure you want to delete <strong>{deletingSchema.name}</strong>?
                                This cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deletingSchema.id)}
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
