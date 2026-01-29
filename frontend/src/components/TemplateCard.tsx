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

interface TemplateCardProps {
    template: Template;
    onImport: (templateId: string) => void;
}

// Regulation badge colors
const regulationColors: Record<string, string> = {
    MiFIR: 'badge-info',
    EMIR: 'badge-warning',
    SFTR: 'badge-success',
};

// Icons
const Icons = {
    Document: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
    ),
    ExternalLink: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
    ),
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
    ),
};

export default function TemplateCard({ template, onImport }: TemplateCardProps) {
    const badgeClass = regulationColors[template.regulation] || 'badge-gray';

    return (
        <div className="card p-6 hover:shadow-lg transition-shadow">
            {/* Header with regulation badge */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Icons.Document />
                    </div>
                    <div>
                        <span className={`badge ${badgeClass}`}>{template.regulation}</span>
                        <span className="ml-2 text-xs text-gray-400">v{template.version}</span>
                    </div>
                </div>
            </div>

            {/* Title and description */}
            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                {template.name}
            </h3>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[40px]">
                {template.description}
            </p>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <span>{template.field_count} field mappings</span>
                <span className="capitalize">{template.category.replace(/_/g, ' ')}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                {template.documentation_url && (
                    <a
                        href={template.documentation_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm text-gray-500 hover:text-gray-700"
                    >
                        <Icons.ExternalLink />
                        <span className="ml-1">Docs</span>
                    </a>
                )}
                <button
                    onClick={() => onImport(template.id)}
                    className="btn btn-primary btn-sm ml-auto"
                >
                    <Icons.Download />
                    <span className="ml-1">Import</span>
                </button>
            </div>
        </div>
    );
}
