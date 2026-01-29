import { useState } from 'react';
import { useQuery } from 'react-query';
import { templatesAPI } from '../services/api';
import { LoadingState } from './LoadingState';
import TemplateCard from './TemplateCard';
import TemplateImportModal from './TemplateImportModal';

interface Template {
    id: string;
    name: string;
    description: string;
    regulation: string;
    version: string;
    category: string;
    field_count: number;
    documentation_url: string;
}

interface TemplateCatalogProps {
    onImportSuccess?: () => void;
}

// Icons
const Icons = {
    Search: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
    ),
};

const REGULATIONS = ['All', 'MiFIR', 'EMIR', 'SFTR'];

export default function TemplateCatalog({ onImportSuccess }: TemplateCatalogProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRegulation, setSelectedRegulation] = useState('All');
    const [importingTemplateId, setImportingTemplateId] = useState<string | null>(null);

    // Fetch templates
    const { data: templates, isLoading, error } = useQuery(
        ['templates', selectedRegulation === 'All' ? undefined : selectedRegulation],
        () => templatesAPI.list(
            selectedRegulation === 'All' ? undefined : selectedRegulation
        ).then(res => res.data),
        { staleTime: 60000 } // Cache for 1 minute
    );

    // Filter by search term
    const filteredTemplates = (templates || []).filter((t: Template) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleImport = (templateId: string) => {
        setImportingTemplateId(templateId);
    };

    const handleImportComplete = () => {
        setImportingTemplateId(null);
        onImportSuccess?.();
    };

    if (isLoading) {
        return <LoadingState message="Loading templates..." />;
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-red-600">Failed to load templates</p>
                <p className="text-sm text-gray-500 mt-2">
                    {(error as any)?.response?.data?.detail || 'Please try again later'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with search and filter */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Icons.Search />
                    </div>
                    <input
                        type="text"
                        className="input pl-10"
                        placeholder="Search templates..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Regulation filter */}
                <div className="flex gap-2">
                    {REGULATIONS.map(reg => (
                        <button
                            key={reg}
                            onClick={() => setSelectedRegulation(reg)}
                            className={`btn btn-sm ${
                                selectedRegulation === reg
                                    ? 'btn-primary'
                                    : 'btn-secondary'
                            }`}
                        >
                            {reg}
                        </button>
                    ))}
                </div>
            </div>

            {/* Templates grid */}
            {filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">
                        {searchTerm
                            ? 'No templates match your search'
                            : 'No templates available'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template: Template) => (
                        <TemplateCard
                            key={template.id}
                            template={template}
                            onImport={handleImport}
                        />
                    ))}
                </div>
            )}

            {/* Import Modal */}
            {importingTemplateId && (
                <TemplateImportModal
                    templateId={importingTemplateId}
                    onClose={() => setImportingTemplateId(null)}
                    onSuccess={handleImportComplete}
                />
            )}
        </div>
    );
}
