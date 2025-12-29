
// import { XMarkIcon } from '@heroicons/react/24/outline'; // Removed to avoid dependency error

interface LineageSidePanelProps {
    edge: any;
    onClose: () => void;
}

export default function LineageSidePanel({ edge, onClose }: LineageSidePanelProps) {
    if (!edge) return null;

    const { relationshipType, sourceFields, targetFields, transformation } = edge.data || {};

    return (
        <div className="absolute inset-y-0 right-0 w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out border-l border-gray-200 z-50 overflow-y-auto h-full">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Lineage Details</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Relationship Type */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Relationship</h4>
                        <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full inline-block text-sm font-medium">
                            {relationshipType || edge.label || 'Unknown'}
                        </div>
                    </div>

                    {/* Transformation Description */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Transformation Logic</h4>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            {transformation || 'Direct mapping or unknown transformation'}
                        </p>
                    </div>

                    {/* Source Fields */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Source Fields</h4>
                        {sourceFields && sourceFields.length > 0 ? (
                            <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                                {sourceFields.map((field: string, idx: number) => (
                                    <li key={idx} className="px-3 py-2 text-sm text-gray-700 font-mono">
                                        {field}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-400 italic">No specific source fields identified</p>
                        )}
                    </div>

                    {/* Target Fields */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Target Fields</h4>
                        {targetFields && targetFields.length > 0 ? (
                            <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                                {targetFields.map((field: string, idx: number) => (
                                    <li key={idx} className="px-3 py-2 text-sm text-gray-700 font-mono">
                                        {field}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-400 italic">No specific target fields identified</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
