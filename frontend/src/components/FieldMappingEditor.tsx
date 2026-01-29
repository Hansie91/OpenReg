import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { reportsAPI, connectorsAPI } from '../services/api';
import { useToast } from '../store/toastStore';

interface FieldMapping {
    sourceColumn: string;
    targetXPath: string;
    transform: string;
    defaultValue: string;
}

interface FieldMappingEditorProps {
    reportId: string;
    versionId: string;
    connectorId?: string;
    initialMappings: FieldMapping[];
    onSave?: () => void;
}

// Transform options (same as ReportWizard)
const TRANSFORM_OPTIONS = [
    { value: '', label: 'None' },
    { value: 'UPPER', label: 'Uppercase' },
    { value: 'LOWER', label: 'Lowercase' },
    { value: 'TRIM', label: 'Trim whitespace' },
    { value: 'DATE_ISO', label: 'Date (ISO 8601)' },
    { value: 'DATE_YYYYMMDD', label: 'Date (YYYYMMDD)' },
    { value: 'DECIMAL_2', label: 'Decimal (2 places)' },
    { value: 'DECIMAL_4', label: 'Decimal (4 places)' },
    { value: 'INTEGER', label: 'Integer' },
    { value: 'BOOLEAN_YN', label: 'Boolean (Y/N)' },
    { value: 'BOOLEAN_TF', label: 'Boolean (true/false)' },
];

// Icons
const Icons = {
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    Trash: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
    ),
    Save: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
};

export default function FieldMappingEditor({
    reportId,
    versionId,
    connectorId,
    initialMappings,
    onSave
}: FieldMappingEditorProps) {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();
    const [mappings, setMappings] = useState<FieldMapping[]>(initialMappings || []);
    const [isDirty, setIsDirty] = useState(false);

    // Fetch tables from connector if available
    const { data: connectorTables } = useQuery(
        ['connector-tables', connectorId],
        () => connectorId ? connectorsAPI.getTables(connectorId).then(res => res.data.tables) : null,
        { enabled: !!connectorId }
    );

    // Get columns from selected table (for column dropdown)
    const [selectedTable, setSelectedTable] = useState<string>('');
    const { data: columns } = useQuery(
        ['table-columns', connectorId, selectedTable],
        () => {
            if (!connectorId || !selectedTable) return null;
            const [schema, table] = selectedTable.includes('.')
                ? selectedTable.split('.')
                : ['', selectedTable];
            return connectorsAPI.getColumns(connectorId, table, schema || undefined).then(res => res.data.columns);
        },
        { enabled: !!connectorId && !!selectedTable }
    );

    // Update mappings mutation
    const saveMutation = useMutation(
        async () => {
            // Get current version to preserve other config
            const versionRes = await reportsAPI.getVersion(reportId, versionId);
            const currentConfig = versionRes.data.config || {};

            return reportsAPI.updateVersion(reportId, versionId, {
                config: {
                    ...currentConfig,
                    field_mappings: mappings.filter(m => m.sourceColumn || m.targetXPath || m.defaultValue)
                }
            });
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['report', reportId]);
                queryClient.invalidateQueries(['report-version', reportId, versionId]);
                showSuccess('Field mappings saved successfully');
                setIsDirty(false);
                onSave?.();
            },
            onError: (error: any) => {
                showError('Failed to save mappings', error?.response?.data?.detail || 'Please try again');
            }
        }
    );

    // Update local state when initialMappings changes
    useEffect(() => {
        setMappings(initialMappings || []);
        setIsDirty(false);
    }, [initialMappings]);

    const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
        const newMappings = [...mappings];
        newMappings[index] = { ...newMappings[index], [field]: value };
        setMappings(newMappings);
        setIsDirty(true);
    };

    const addMapping = () => {
        setMappings([...mappings, { sourceColumn: '', targetXPath: '', transform: '', defaultValue: '' }]);
        setIsDirty(true);
    };

    const removeMapping = (index: number) => {
        const newMappings = mappings.filter((_, i) => i !== index);
        setMappings(newMappings);
        setIsDirty(true);
    };

    const mappedCount = mappings.filter(m => m.sourceColumn || m.defaultValue).length;

    return (
        <div className="space-y-4">
            {/* Header with table selector and save button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h3 className="font-medium text-gray-900">
                        Field Mappings
                    </h3>
                    <span className="text-sm text-gray-500">
                        {mappedCount} of {mappings.length} mapped
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {connectorId && connectorTables && (
                        <select
                            className="select text-sm"
                            value={selectedTable}
                            onChange={e => setSelectedTable(e.target.value)}
                        >
                            <option value="">Select table for column hints...</option>
                            {connectorTables.map((t: any) => (
                                <option key={t.full_name} value={t.full_name}>
                                    {t.full_name}
                                </option>
                            ))}
                        </select>
                    )}

                    <button
                        onClick={() => saveMutation.mutate()}
                        disabled={!isDirty || saveMutation.isLoading}
                        className="btn btn-primary btn-sm"
                    >
                        <Icons.Save />
                        <span className="ml-1">{saveMutation.isLoading ? 'Saving...' : 'Save'}</span>
                    </button>
                </div>
            </div>

            {isDirty && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-800">
                    You have unsaved changes
                </div>
            )}

            {/* Mapping table */}
            <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-600 uppercase">
                    <div className="col-span-4">Target XPath</div>
                    <div className="col-span-3">Source Column</div>
                    <div className="col-span-2">Transform</div>
                    <div className="col-span-2">Default Value</div>
                    <div className="col-span-1"></div>
                </div>

                <div className="max-h-[500px] overflow-auto divide-y divide-gray-100">
                    {mappings.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500">
                            No field mappings defined. Click "Add Mapping" to create one.
                        </div>
                    ) : (
                        mappings.map((mapping, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2 px-4 py-2 items-center hover:bg-gray-50">
                                <div className="col-span-4">
                                    <input
                                        type="text"
                                        className="input text-sm py-1 font-mono"
                                        placeholder="/Root/Element/Path"
                                        value={mapping.targetXPath}
                                        onChange={e => updateMapping(index, 'targetXPath', e.target.value)}
                                    />
                                </div>
                                <div className="col-span-3">
                                    {columns ? (
                                        <select
                                            className="select text-sm py-1"
                                            value={mapping.sourceColumn}
                                            onChange={e => updateMapping(index, 'sourceColumn', e.target.value)}
                                        >
                                            <option value="">--</option>
                                            {columns.map((col: any) => (
                                                <option key={col.name} value={col.name}>
                                                    {col.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="input text-sm py-1 font-mono"
                                            placeholder="column_name"
                                            value={mapping.sourceColumn}
                                            onChange={e => updateMapping(index, 'sourceColumn', e.target.value)}
                                        />
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <select
                                        className="select text-sm py-1"
                                        value={mapping.transform}
                                        onChange={e => updateMapping(index, 'transform', e.target.value)}
                                    >
                                        {TRANSFORM_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <input
                                        type="text"
                                        className="input text-sm py-1"
                                        placeholder="default..."
                                        value={mapping.defaultValue}
                                        onChange={e => updateMapping(index, 'defaultValue', e.target.value)}
                                    />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button
                                        onClick={() => removeMapping(index)}
                                        className="btn btn-ghost btn-icon btn-sm text-red-500 hover:text-red-700"
                                        title="Remove mapping"
                                    >
                                        <Icons.Trash />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add button */}
            <div className="flex justify-start">
                <button
                    onClick={addMapping}
                    className="btn btn-secondary btn-sm"
                >
                    <Icons.Plus />
                    <span className="ml-1">Add Mapping</span>
                </button>
            </div>
        </div>
    );
}
