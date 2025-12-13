import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { reportsAPI, connectorsAPI, schemasAPI } from '../services/api';

interface WizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface FieldMapping {
    sourceColumn: string;
    targetXPath: string;
    transform: string;
    defaultValue: string;
}

interface SchemaElement {
    name: string;
    xpath: string;
    type: string;
    required: boolean;
    documentation: string;
    enumerations: string[];
}

interface TableColumn {
    name: string;
    type: string;
    nullable: boolean;
}

interface TableInfo {
    schema: string;
    name: string;
    full_name: string;
}

// Transform options for field mapping
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
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    ChevronRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
    ),
    ChevronLeft: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
    ),
    Code: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
        </svg>
    ),
    Table: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125-.504-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125m10.875 0h.008v.008h-.008v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
    ),
    Link: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
    ),
};

const STEPS = [
    { id: 1, name: 'Mode', description: 'Choose report type' },
    { id: 2, name: 'Basic Info', description: 'Name and description' },
    { id: 3, name: 'Data Source', description: 'Select connector and table' },
    { id: 4, name: 'Schema', description: 'Select output schema' },
    { id: 5, name: 'Mapping', description: 'Map fields' },
    { id: 6, name: 'Review', description: 'Confirm and create' },
];

export default function ReportWizard({ isOpen, onClose, onSuccess }: WizardProps) {
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(1);

    // Form state
    const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
    const [reportName, setReportName] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [connectorId, setConnectorId] = useState('');
    const [selectedTable, setSelectedTable] = useState('');
    const [schemaId, setSchemaId] = useState('');
    const [mappings, setMappings] = useState<FieldMapping[]>([]);
    const [pythonCode, setPythonCode] = useState('');

    // Fetch data
    const { data: connectors } = useQuery('connectors', () =>
        connectorsAPI.list().then(res => res.data)
    );

    const { data: schemas } = useQuery('schemas', () =>
        schemasAPI.list().then(res => res.data.schemas)
    );

    const { data: tables, isLoading: tablesLoading, error: tablesError } = useQuery(
        ['connector-tables', connectorId],
        () => connectorId ? connectorsAPI.getTables(connectorId).then(res => res.data.tables) : null,
        { enabled: !!connectorId, retry: false }
    );

    const { data: columns, isLoading: columnsLoading } = useQuery(
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

    const { data: schemaElements } = useQuery(
        ['schema-elements', schemaId],
        () => schemaId ? schemasAPI.getElements(schemaId).then(res => res.data.elements) : null,
        { enabled: !!schemaId }
    );

    // Initialize mappings when columns and schema elements are loaded
    useEffect(() => {
        if (columns && schemaElements && mappings.length === 0) {
            const initialMappings: FieldMapping[] = schemaElements
                .filter((elem: SchemaElement) => elem.required || !elem.xpath.includes('/@'))
                .slice(0, 50) // Limit to 50 for performance
                .map((elem: SchemaElement) => {
                    // Try to auto-match by name
                    const matchingColumn = columns.find((col: TableColumn) =>
                        col.name.toLowerCase() === elem.name.toLowerCase() ||
                        col.name.toLowerCase().replace(/_/g, '') === elem.name.toLowerCase()
                    );
                    return {
                        sourceColumn: matchingColumn?.name || '',
                        targetXPath: elem.xpath,
                        transform: '',
                        defaultValue: ''
                    };
                });
            setMappings(initialMappings);
        }
    }, [columns, schemaElements]);

    // Create report mutation
    const createMutation = useMutation(
        async () => {
            const config = mode === 'simple' ? {
                mode: 'simple',
                source_table: selectedTable,
                schema_id: schemaId,
                field_mappings: mappings.filter(m => m.sourceColumn || m.defaultValue),
                output_format: 'xml'
            } : {
                mode: 'advanced',
                python_code: pythonCode
            };

            return reportsAPI.create({
                name: reportName,
                description: reportDescription,
                connector_id: connectorId || undefined,
                config
            });
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries('reports');
                onSuccess();
                resetForm();
            }
        }
    );

    const resetForm = () => {
        setCurrentStep(1);
        setMode('simple');
        setReportName('');
        setReportDescription('');
        setConnectorId('');
        setSelectedTable('');
        setSchemaId('');
        setMappings([]);
        setPythonCode('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
        const newMappings = [...mappings];
        newMappings[index] = { ...newMappings[index], [field]: value };
        setMappings(newMappings);
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1: return true;
            case 2: return reportName.trim().length > 0;
            case 3: return mode === 'advanced' || (connectorId && selectedTable);
            case 4: return mode === 'advanced' || schemaId;
            case 5: return mode === 'advanced' || mappings.some(m => m.sourceColumn || m.defaultValue);
            case 6: return true;
            default: return false;
        }
    };

    const getStepsForMode = () => {
        if (mode === 'advanced') {
            return STEPS.filter(s => [1, 2, 6].includes(s.id));
        }
        return STEPS;
    };

    const visibleSteps = getStepsForMode();
    const currentStepIndex = visibleSteps.findIndex(s => s.id === currentStep);

    const goNext = () => {
        const nextIndex = currentStepIndex + 1;
        if (nextIndex < visibleSteps.length) {
            setCurrentStep(visibleSteps[nextIndex].id);
        }
    };

    const goBack = () => {
        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
            setCurrentStep(visibleSteps[prevIndex].id);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Create Report</h2>
                        <p className="text-sm text-gray-500">
                            {visibleSteps.find(s => s.id === currentStep)?.description}
                        </p>
                    </div>
                    <button onClick={handleClose} className="btn btn-ghost btn-icon">
                        <Icons.Close />
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        {visibleSteps.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${step.id === currentStep
                                    ? 'bg-indigo-600 text-white'
                                    : step.id < currentStep
                                        ? 'bg-green-500 text-white'
                                        : 'bg-gray-200 text-gray-600'
                                    }`}>
                                    {step.id < currentStep ? <Icons.Check /> : index + 1}
                                </div>
                                <span className={`ml-2 text-sm ${step.id === currentStep ? 'text-indigo-600 font-medium' : 'text-gray-500'
                                    }`}>
                                    {step.name}
                                </span>
                                {index < visibleSteps.length - 1 && (
                                    <div className="w-12 h-0.5 mx-4 bg-gray-200">
                                        <div className={`h-full transition-all ${step.id < currentStep ? 'bg-green-500 w-full' : 'w-0'
                                            }`} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Step 1: Mode Selection */}
                    {currentStep === 1 && (
                        <div className="max-w-2xl mx-auto">
                            <h3 className="text-lg font-medium text-gray-900 mb-6 text-center">
                                Choose how you want to create your report
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <button
                                    onClick={() => setMode('simple')}
                                    className={`p-6 rounded-xl border-2 transition-all text-left ${mode === 'simple'
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${mode === 'simple' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        <Icons.Table />
                                    </div>
                                    <h4 className="font-semibold text-gray-900 mb-2">Simple Mode</h4>
                                    <p className="text-sm text-gray-600">
                                        Select a table and map columns to your XSD schema. No coding required.
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="badge badge-success">No Code</span>
                                        <span className="badge badge-info">Visual Mapping</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setMode('advanced')}
                                    className={`p-6 rounded-xl border-2 transition-all text-left ${mode === 'advanced'
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${mode === 'advanced' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        <Icons.Code />
                                    </div>
                                    <h4 className="font-semibold text-gray-900 mb-2">Advanced Mode</h4>
                                    <p className="text-sm text-gray-600">
                                        Write Python code for complex transformations and custom output logic.
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="badge badge-warning">Python</span>
                                        <span className="badge badge-gray">Full Control</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Basic Info */}
                    {currentStep === 2 && (
                        <div className="max-w-xl mx-auto space-y-6">
                            <div>
                                <label className="input-label">Report Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="MiFIR Transaction Report"
                                    value={reportName}
                                    onChange={e => setReportName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="Daily transaction reporting for MiFIR compliance..."
                                    value={reportDescription}
                                    onChange={e => setReportDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Data Source */}
                    {currentStep === 3 && (
                        <div className="max-w-xl mx-auto space-y-6">
                            <div>
                                <label className="input-label">Data Connector *</label>
                                <select
                                    className="select"
                                    value={connectorId}
                                    onChange={e => {
                                        setConnectorId(e.target.value);
                                        setSelectedTable('');
                                    }}
                                >
                                    <option value="">Select a connector...</option>
                                    {connectors?.map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {connectorId && (
                                <div>
                                    <label className="input-label">Source Table *</label>
                                    {tablesLoading ? (
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <div className="spinner"></div>
                                            Loading tables...
                                        </div>
                                    ) : tablesError ? (
                                        <div className="alert alert-error">
                                            <Icons.Close />
                                            <span>{(tablesError as any)?.response?.data?.detail || "Failed to load tables"}</span>
                                        </div>
                                    ) : (
                                        <select
                                            className="select"
                                            value={selectedTable}
                                            onChange={e => setSelectedTable(e.target.value)}
                                        >
                                            <option value="">Select a table...</option>
                                            {tables?.map((t: TableInfo) => (
                                                <option key={t.full_name} value={t.full_name}>
                                                    {t.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {selectedTable && columns && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                    <h4 className="font-medium text-gray-900 mb-2">
                                        Columns ({columns.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {columns.slice(0, 15).map((col: TableColumn) => (
                                            <span key={col.name} className="badge badge-gray font-mono text-xs">
                                                {col.name}
                                            </span>
                                        ))}
                                        {columns.length > 15 && (
                                            <span className="badge badge-info">
                                                +{columns.length - 15} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Schema Selection */}
                    {currentStep === 4 && (
                        <div className="max-w-xl mx-auto space-y-6">
                            <div>
                                <label className="input-label">Output Schema (XSD) *</label>
                                <select
                                    className="select"
                                    value={schemaId}
                                    onChange={e => {
                                        setSchemaId(e.target.value);
                                        setMappings([]); // Reset mappings when schema changes
                                    }}
                                >
                                    <option value="">Select a schema...</option>
                                    {schemas?.map((s: any) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} {s.version && `(${s.version})`} - {s.element_count} elements
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Don't see your schema? <a href="/schemas" className="text-indigo-600 hover:underline">Upload one first</a>
                                </p>
                            </div>

                            {schemaId && schemaElements && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                    <h4 className="font-medium text-gray-900 mb-2">
                                        Schema Elements ({schemaElements.length})
                                    </h4>
                                    <div className="max-h-48 overflow-auto space-y-1 text-sm">
                                        {schemaElements.slice(0, 20).map((elem: SchemaElement, i: number) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <span className="font-mono text-indigo-600">{elem.xpath}</span>
                                                <span className="badge badge-gray text-xs">{elem.type}</span>
                                                {elem.required && <span className="text-red-500 text-xs">required</span>}
                                            </div>
                                        ))}
                                        {schemaElements.length > 20 && (
                                            <p className="text-gray-500">...and {schemaElements.length - 20} more</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 5: Field Mapping */}
                    {currentStep === 5 && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-medium text-gray-900">
                                    Map Source Columns to XML Elements
                                </h3>
                                <span className="text-sm text-gray-500">
                                    {mappings.filter(m => m.sourceColumn).length} of {mappings.length} mapped
                                </span>
                            </div>

                            {columnsLoading ? (
                                <div className="text-center py-12">
                                    <div className="spinner mx-auto"></div>
                                    <p className="mt-2 text-gray-500">Loading columns...</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-600 uppercase">
                                        <div className="col-span-4">XML Element</div>
                                        <div className="col-span-3">Source Column</div>
                                        <div className="col-span-2">Transform</div>
                                        <div className="col-span-3">Default Value</div>
                                    </div>
                                    <div className="max-h-96 overflow-auto divide-y divide-gray-100">
                                        {mappings.map((mapping, index) => {
                                            const schemaElem = schemaElements?.find(
                                                (e: SchemaElement) => e.xpath === mapping.targetXPath
                                            );
                                            return (
                                                <div key={index} className="grid grid-cols-12 gap-2 px-4 py-2 items-center hover:bg-gray-50">
                                                    <div className="col-span-4">
                                                        <div className="font-mono text-sm text-indigo-600 truncate" title={mapping.targetXPath}>
                                                            {mapping.targetXPath}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {schemaElem?.type}
                                                            {schemaElem?.required && <span className="text-red-500 ml-1">*</span>}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-3">
                                                        <select
                                                            className="select text-sm py-1"
                                                            value={mapping.sourceColumn}
                                                            onChange={e => updateMapping(index, 'sourceColumn', e.target.value)}
                                                        >
                                                            <option value="">—</option>
                                                            {columns?.map((col: TableColumn) => (
                                                                <option key={col.name} value={col.name}>
                                                                    {col.name}
                                                                </option>
                                                            ))}
                                                        </select>
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
                                                    <div className="col-span-3">
                                                        <input
                                                            type="text"
                                                            className="input text-sm py-1"
                                                            placeholder="Default..."
                                                            value={mapping.defaultValue}
                                                            onChange={e => updateMapping(index, 'defaultValue', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 6: Review */}
                    {currentStep === 6 && (
                        <div className="max-w-2xl mx-auto">
                            <h3 className="text-lg font-medium text-gray-900 mb-6">Review Your Report</h3>

                            <div className="space-y-4">
                                <div className="card p-4">
                                    <h4 className="text-sm font-medium text-gray-500 mb-2">Basic Info</h4>
                                    <p className="font-semibold text-gray-900">{reportName}</p>
                                    {reportDescription && <p className="text-sm text-gray-600 mt-1">{reportDescription}</p>}
                                </div>

                                <div className="card p-4">
                                    <h4 className="text-sm font-medium text-gray-500 mb-2">Mode</h4>
                                    <span className={`badge ${mode === 'simple' ? 'badge-success' : 'badge-warning'}`}>
                                        {mode === 'simple' ? 'Simple (Declarative)' : 'Advanced (Python)'}
                                    </span>
                                </div>

                                {mode === 'simple' && (
                                    <>
                                        <div className="card p-4">
                                            <h4 className="text-sm font-medium text-gray-500 mb-2">Data Source</h4>
                                            <p className="font-mono text-gray-900">{selectedTable}</p>
                                        </div>

                                        <div className="card p-4">
                                            <h4 className="text-sm font-medium text-gray-500 mb-2">Field Mappings</h4>
                                            <p className="text-gray-900">
                                                {mappings.filter(m => m.sourceColumn).length} columns mapped
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={currentStepIndex > 0 ? goBack : handleClose}
                        className="btn btn-secondary"
                    >
                        <Icons.ChevronLeft />
                        <span className="ml-1">{currentStepIndex > 0 ? 'Back' : 'Cancel'}</span>
                    </button>

                    <div className="flex items-center gap-3">
                        {currentStep === visibleSteps[visibleSteps.length - 1].id ? (
                            <button
                                onClick={() => createMutation.mutate()}
                                disabled={createMutation.isLoading}
                                className="btn btn-primary"
                            >
                                {createMutation.isLoading ? 'Creating...' : 'Create Report'}
                            </button>
                        ) : (
                            <button
                                onClick={goNext}
                                disabled={!canProceed()}
                                className="btn btn-primary"
                            >
                                <span className="mr-1">Next</span>
                                <Icons.ChevronRight />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
