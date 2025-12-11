import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { mappingsAPI, reportsAPI } from '../services/api';

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
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<any>(null);
    const [selectedSet, setSelectedSet] = useState<MappingSet | null>(null);
    const [editingEntry, setEditingEntry] = useState<any>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('source_value');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [entryForm, setEntryForm] = useState({
        source_value: '',
        target_value: '',
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
        report_ids: [] as string[],
    });

    // Fetch mapping sets
    const { data: mappingSets } = useQuery(
        'mappings',
        () => mappingsAPI.listSets().then((res) => res.data)
    );

    // Fetch reports for the multi-select
    const { data: reports } = useQuery(
        'reports',
        () => reportsAPI.list().then((res: any) => res.data)
    );

    // Fetch entries for selected set with search and sort
    const { data: entries, isLoading: entriesLoading } = useQuery(
        ['mapping-entries', selectedSet?.id, searchTerm, sortBy, sortOrder],
        () => mappingsAPI.listEntries(selectedSet!.id, {
            search: searchTerm || undefined,
            sort_by: sortBy,
            sort_order: sortOrder
        }).then((res) => res.data),
        { enabled: !!selectedSet }
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
                setSelectedSet(null);
            },
        }
    );

    const createEntryMutation = useMutation(
        (data: any) => mappingsAPI.createEntry(selectedSet!.id, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['mapping-entries', selectedSet?.id]);
                setShowEntryModal(false);
                setEntryForm({
                    source_value: '',
                    target_value: '',
                    effective_from: new Date().toISOString().split('T')[0],
                    effective_to: '',
                    report_ids: [],
                });
            },
        }
    );

    const deleteEntryMutation = useMutation(
        ({ setId, entryId }: { setId: string; entryId: string }) =>
            mappingsAPI.deleteEntry(setId, entryId),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['mapping-entries', selectedSet?.id]);
            },
            onError: (error: any) => {
                console.error('Delete error:', error);
                alert(`Failed to delete entry: ${error.response?.data?.detail || error.message}`);
            },
        }
    );

    const updateEntryMutation = useMutation(
        ({ setId, entryId, data }: { setId: string; entryId: string; data: any }) =>
            mappingsAPI.updateEntry(setId, entryId, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['mapping-entries', selectedSet?.id]);
                setShowEditModal(false);
                setEditingEntry(null);
            },
        }
    );

    const handleCreateEntry = () => {
        if (!entryForm.source_value || !entryForm.target_value) {
            alert('Please fill in source and target values');
            return;
        }
        createEntryMutation.mutate({
            ...entryForm,
            effective_to: entryForm.effective_to || null,
        });
    };

    const handleEditEntry = (entry: any) => {
        setEditingEntry({
            ...entry,
            report_ids: entry.report_ids || []
        });
        setShowEditModal(true);
    };

    const handleUpdateEntry = () => {
        if (!editingEntry || !selectedSet) return;
        updateEntryMutation.mutate({
            setId: selectedSet.id,
            entryId: editingEntry.id,
            data: {
                source_value: editingEntry.source_value,
                target_value: editingEntry.target_value,
                effective_from: editingEntry.effective_from,
                effective_to: editingEntry.effective_to || null,
                report_ids: editingEntry.report_ids || [],
            }
        });
    };

    const handleImportCSV = async () => {
        if (!importFile || !selectedSet) return;
        try {
            await mappingsAPI.importCSV(selectedSet.id, importFile);
            queryClient.invalidateQueries(['mapping-entries', selectedSet.id]);
            setShowImportModal(false);
            setImportFile(null);
            alert('Import successful!');
        } catch (error: any) {
            alert(`Import failed: ${error.response?.data?.detail || error.message}`);
        }
    };

    const handleExportCSV = async () => {
        if (!selectedSet) return;
        try {
            const response = await mappingsAPI.exportCSV(selectedSet.id);
            // Create blob and download
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedSet.name}_mappings.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error: any) {
            alert(`Export failed: ${error.response?.data?.detail || error.message}`);
        }
    };

    const toggleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

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
                    <button onClick={() => setShowImportModal(true)} className="btn btn-secondary">
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
                        <div className="border-t border-gray-200">
                            {mappingSets && mappingSets.length > 0 ? (
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
                        </div>
                    </div>
                </div>

                {/* Entries Table */}
                <div className="col-span-8">
                    {selectedSet ? (
                        <div className="card">
                            <div className="card-header">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{selectedSet.name}</h3>
                                        <p className="text-sm text-gray-500">{selectedSet.description}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleExportCSV} className="btn btn-secondary text-sm">
                                            <Icons.Download />
                                            <span className="ml-1">Export</span>
                                        </button>
                                        <button onClick={() => setShowEntryModal(true)} className="btn btn-primary text-sm">
                                            <Icons.Plus />
                                            <span className="ml-1">Add Entry</span>
                                        </button>
                                    </div>
                                </div>
                                {/* Search Bar */}
                                <div className="mt-3">
                                    <input
                                        type="text"
                                        placeholder="Search source or target values..."
                                        className="input w-full"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            {entriesLoading ? (
                                <div className="p-8 text-center">
                                    <div className="spinner mx-auto text-indigo-600"></div>
                                </div>
                            ) : entries && entries.length > 0 ? (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th
                                                onClick={() => toggleSort('source_value')}
                                                className="cursor-pointer hover:bg-gray-50"
                                            >
                                                Source Value {sortBy === 'source_value' && (sortOrder === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th
                                                onClick={() => toggleSort('target_value')}
                                                className="cursor-pointer hover:bg-gray-50"
                                            >
                                                Target Value {sortBy === 'target_value' && (sortOrder === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th>Reports</th>
                                            <th
                                                onClick={() => toggleSort('effective_from')}
                                                className="cursor-pointer hover:bg-gray-50"
                                            >
                                                Effective From {sortBy === 'effective_from' && (sortOrder === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th>Effective To</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((entry: any) => (
                                            <tr key={entry.id}>
                                                <td className="font-mono font-medium">{entry.source_value}</td>
                                                <td>{entry.target_value}</td>
                                                <td>
                                                    {entry.report_ids && entry.report_ids.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {entry.report_ids.map((reportId: string) => {
                                                                const report = reports?.find((r: any) => r.id === reportId);
                                                                return report ? (
                                                                    <span key={reportId} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                                                        {report.name}
                                                                    </span>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">All reports</span>
                                                    )}
                                                </td>
                                                <td>{entry.effective_from}</td>
                                                <td>{entry.effective_to || <span className="text-gray-400">—</span>}</td>
                                                <td>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleEditEntry(entry)}
                                                            className="btn btn-ghost btn-icon text-indigo-600"
                                                        >
                                                            <Icons.Edit />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeleteConfirmEntry(entry);
                                                            }}
                                                            className="btn btn-ghost btn-icon text-red-600"
                                                            type="button"
                                                            title="Delete entry"
                                                        >
                                                            <Icons.Trash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-gray-500">
                                    <p>No entries yet. Click "Add Entry" to create your first mapping.</p>
                                </div>
                            )}
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

            {/* Entry Modal */}
            {showEntryModal && selectedSet && (
                <div className="modal-overlay" onClick={() => setShowEntryModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Mapping Entry</h3>
                            <button onClick={() => setShowEntryModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Source Value *</label>
                                    <input
                                        type="text"
                                        className="input font-mono"
                                        placeholder="XLON"
                                        value={entryForm.source_value}
                                        onChange={(e) => setEntryForm({ ...entryForm, source_value: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Target Value *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="London Stock Exchange"
                                        value={entryForm.target_value}
                                        onChange={(e) => setEntryForm({ ...entryForm, target_value: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Effective From *</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={entryForm.effective_from}
                                        onChange={(e) => setEntryForm({ ...entryForm, effective_from: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Effective To</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={entryForm.effective_to}
                                        onChange={(e) => setEntryForm({ ...entryForm, effective_to: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="input-label">Associated Reports (Optional)</label>
                                <select
                                    multiple
                                    className="input min-h-[120px]"
                                    value={entryForm.report_ids}
                                    onChange={(e) => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                                        setEntryForm({ ...entryForm, report_ids: selected });
                                    }}
                                >
                                    {reports?.map((report: any) => (
                                        <option key={report.id} value={report.id}>
                                            {report.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Hold Ctrl/Cmd to select multiple reports. Leave empty to allow all reports to use this entry.
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowEntryModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateEntry}
                                disabled={createEntryMutation.isLoading}
                                className="btn btn-primary"
                            >
                                {createEntryMutation.isLoading ? 'Creating...' : 'Create Entry'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import CSV Modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Import CSV</h3>
                            <button onClick={() => setShowImportModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div>
                                <label className="input-label">Select Mapping Set</label>
                                <select
                                    className="select"
                                    value={selectedSet?.id || ''}
                                    onChange={(e) => {
                                        const set = mappingSets?.find((s: any) => s.id === e.target.value);
                                        setSelectedSet(set || null);
                                    }}
                                >
                                    <option value="">Choose a mapping set...</option>
                                    {mappingSets?.map((set: any) => (
                                        <option key={set.id} value={set.id}>{set.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="input-label">CSV File</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="input"
                                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    CSV format: source_value, target_value, effective_from, effective_to
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowImportModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleImportCSV}
                                disabled={!importFile || !selectedSet}
                                className="btn btn-primary"
                            >
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Entry Modal */}
            {showEditModal && editingEntry && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Mapping Entry</h3>
                            <button onClick={() => setShowEditModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Source Value *</label>
                                    <input
                                        type="text"
                                        className="input font-mono"
                                        value={editingEntry.source_value}
                                        onChange={(e) => setEditingEntry({ ...editingEntry, source_value: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Target Value *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={editingEntry.target_value}
                                        onChange={(e) => setEditingEntry({ ...editingEntry, target_value: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Effective From *</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={editingEntry.effective_from}
                                        onChange={(e) => setEditingEntry({ ...editingEntry, effective_from: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Effective To</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={editingEntry.effective_to || ''}
                                        onChange={(e) => setEditingEntry({ ...editingEntry, effective_to: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="input-label">Associated Reports (Optional)</label>
                                <select
                                    multiple
                                    className="input min-h-[120px]"
                                    value={editingEntry.report_ids || []}
                                    onChange={(e) => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                                        setEditingEntry({ ...editingEntry, report_ids: selected });
                                    }}
                                >
                                    {reports?.map((report: any) => (
                                        <option key={report.id} value={report.id}>
                                            {report.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Hold Ctrl/Cmd to select multiple reports. Leave empty to allow all reports to use this entry.
                                </p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateEntry}
                                disabled={updateEntryMutation.isLoading}
                                className="btn btn-primary"
                            >
                                {updateEntryMutation.isLoading ? 'Updating...' : 'Update Entry'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmEntry && (
                <div className="modal-overlay" onClick={() => setDeleteConfirmEntry(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Confirm Delete</h3>
                            <button onClick={() => setDeleteConfirmEntry(null)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete this mapping entry?</p>
                            <div className="mt-4 p-3 bg-gray-50 rounded">
                                <div className="text-sm">
                                    <span className="font-medium">Source:</span> <code className="font-mono">{deleteConfirmEntry.source_value}</code>
                                </div>
                                <div className="text-sm mt-1">
                                    <span className="font-medium">Target:</span> {deleteConfirmEntry.target_value}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setDeleteConfirmEntry(null)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (selectedSet) {
                                        deleteEntryMutation.mutate({
                                            setId: selectedSet.id,
                                            entryId: deleteConfirmEntry.id
                                        });
                                        setDeleteConfirmEntry(null);
                                    }
                                }}
                                className="btn btn-danger bg-red-600 hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
