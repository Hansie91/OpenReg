import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { mappingsAPI } from '../services/api';

interface MappingSet {
    id: string;
    name: string;
    description: string;
    created_at: string;
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
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
    ),
    Mapping: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
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

export default function Mappings() {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedSet, setSelectedSet] = useState<MappingSet | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const { data: mappingSets, isLoading } = useQuery('mappings', () =>
        mappingsAPI.listSets().then((res) => res.data)
    );

    const createMutation = useMutation(
        (data: any) => mappingsAPI.createSet(data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('mappings');
                setShowCreateModal(false);
                setName('');
                setDescription('');
            },
        }
    );

    const deleteMutation = useMutation(
        (id: string) => mappingsAPI.deleteSet(id),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('mappings');
            },
        }
    );

    // Sample entries for demo
    const sampleEntries = [
        { source: 'XLON', target: 'London Stock Exchange', effectiveFrom: '2024-01-01', effectiveTo: null },
        { source: 'XNYS', target: 'New York Stock Exchange', effectiveFrom: '2024-01-01', effectiveTo: null },
        { source: 'XNAS', target: 'NASDAQ', effectiveFrom: '2024-01-01', effectiveTo: null },
        { source: 'XPAR', target: 'Euronext Paris', effectiveFrom: '2024-01-01', effectiveTo: null },
    ];

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="page-title">Cross-Reference Mappings</h1>
                    <p className="page-description">
                        Manage code translations and reference data with audit trails
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="btn btn-secondary">
                        <Icons.Upload />
                        <span className="ml-2">Import CSV</span>
                    </button>
                    <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                        <Icons.Plus />
                        <span className="ml-2">New Mapping Set</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Mapping Sets Sidebar */}
                <div className="col-span-4">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="font-semibold text-gray-900">Mapping Sets</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {isLoading ? (
                                <div className="p-6 text-center">
                                    <div className="spinner mx-auto text-indigo-600"></div>
                                </div>
                            ) : mappingSets && mappingSets.length > 0 ? (
                                mappingSets.map((set: MappingSet) => (
                                    <button
                                        key={set.id}
                                        onClick={() => setSelectedSet(set)}
                                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedSet?.id === set.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                                            }`}
                                    >
                                        <p className="font-medium text-gray-900">{set.name}</p>
                                        <p className="text-sm text-gray-500 mt-0.5">{set.description || 'No description'}</p>
                                    </button>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-500">
                                    <p>No mapping sets yet</p>
                                </div>
                            )}
                            {/* Demo data */}
                            {(!mappingSets || mappingSets.length === 0) && (
                                <>
                                    <button
                                        onClick={() => setSelectedSet({ id: '1', name: 'Venue Codes', description: 'MIC to venue name mappings', created_at: '' })}
                                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedSet?.name === 'Venue Codes' ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
                                    >
                                        <p className="font-medium text-gray-900">Venue Codes</p>
                                        <p className="text-sm text-gray-500 mt-0.5">MIC to venue name mappings</p>
                                    </button>
                                    <button
                                        onClick={() => setSelectedSet({ id: '2', name: 'Product Types', description: 'Instrument classifications', created_at: '' })}
                                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selectedSet?.name === 'Product Types' ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
                                    >
                                        <p className="font-medium text-gray-900">Product Types</p>
                                        <p className="text-sm text-gray-500 mt-0.5">Instrument classifications</p>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Entries Table */}
                <div className="col-span-8">
                    {selectedSet ? (
                        <div className="card">
                            <div className="card-header flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{selectedSet.name}</h3>
                                    <p className="text-sm text-gray-500">{selectedSet.description}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-secondary text-sm">
                                        <Icons.Download />
                                        <span className="ml-1">Export</span>
                                    </button>
                                    <button className="btn btn-primary text-sm">
                                        <Icons.Plus />
                                        <span className="ml-1">Add Entry</span>
                                    </button>
                                </div>
                            </div>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Source Value</th>
                                        <th>Target Value</th>
                                        <th>Effective From</th>
                                        <th>Effective To</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sampleEntries.map((entry, idx) => (
                                        <tr key={idx}>
                                            <td className="font-mono font-medium">{entry.source}</td>
                                            <td>{entry.target}</td>
                                            <td>{entry.effectiveFrom}</td>
                                            <td>{entry.effectiveTo || <span className="text-gray-400">—</span>}</td>
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
                    ) : (
                        <div className="card p-12 text-center">
                            <div className="text-gray-300 mx-auto">
                                <Icons.Mapping />
                            </div>
                            <h3 className="mt-4 text-lg font-medium text-gray-900">Select a mapping set</h3>
                            <p className="mt-2 text-sm text-gray-500">
                                Choose a mapping set from the sidebar to view and edit entries
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">New Mapping Set</h3>
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div>
                                <label className="input-label">Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Venue Codes"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="MIC to venue name mappings"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => createMutation.mutate({ name, description })}
                                disabled={!name || createMutation.isLoading}
                                className="btn btn-primary"
                            >
                                {createMutation.isLoading ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
