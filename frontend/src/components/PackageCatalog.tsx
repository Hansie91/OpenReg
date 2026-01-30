import { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { reportsAPI } from '../services/api';
import { ALL_PACKAGES, RegulationPackage } from '../data/regulationPackages';
import { useToast } from '../store/toastStore';

interface PackageCatalogProps {
  onImportSuccess?: () => void;
}

// Icons
const Icons = {
  Search: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  Shield: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  ),
  Document: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  Layers: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" />
    </svg>
  ),
  Check: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  ),
  ArrowRight: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  ),
};

const REGULATIONS = ['All', 'EMIR', 'MIFIR', 'SFTR'];

// Regulation-specific styling
const regulationStyles: Record<string, { bg: string; border: string; text: string; icon: () => JSX.Element }> = {
  EMIR: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: Icons.Shield },
  MIFIR: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', icon: Icons.Document },
  SFTR: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', icon: Icons.Layers },
};

function PackageCard({
  pkg,
  onSelect,
  isCreating
}: {
  pkg: RegulationPackage;
  onSelect: (pkg: RegulationPackage) => void;
  isCreating: boolean;
}) {
  const style = regulationStyles[pkg.regulation_code] || regulationStyles.EMIR;
  const IconComponent = style.icon;

  return (
    <div className={`rounded-xl border-2 ${style.border} ${style.bg} p-5 transition-all hover:shadow-lg`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center ${style.text}`}>
            <IconComponent />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{pkg.regulation_code}</h4>
            <p className="text-xs text-gray-500">{pkg.version}</p>
          </div>
        </div>
      </div>

      {/* Title & Description */}
      <h5 className="font-medium text-gray-900 mb-1">{pkg.regulation_name}</h5>
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pkg.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center bg-white/60 rounded-lg py-2">
          <div className="text-lg font-bold text-gray-900">{pkg.field_count}</div>
          <div className="text-xs text-gray-500">Fields</div>
        </div>
        <div className="text-center bg-white/60 rounded-lg py-2">
          <div className="text-lg font-bold text-red-600">{pkg.mandatory_fields}</div>
          <div className="text-xs text-gray-500">Required</div>
        </div>
        <div className="text-center bg-white/60 rounded-lg py-2">
          <div className="text-lg font-bold text-blue-600">{pkg.validation_rule_count}</div>
          <div className="text-xs text-gray-500">Rules</div>
        </div>
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-1 mb-4">
        <span className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-600">
          {pkg.jurisdiction}
        </span>
        <span className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-600">
          {pkg.reporting_authority}
        </span>
        <span className="px-2 py-0.5 bg-white/60 rounded text-xs text-gray-600">
          {pkg.output_format}
        </span>
      </div>

      {/* Action button */}
      <button
        onClick={() => onSelect(pkg)}
        disabled={isCreating}
        className={`w-full btn btn-primary flex items-center justify-center gap-2 ${style.text.replace('text-', 'bg-').replace('600', '600')} text-white hover:opacity-90`}
      >
        {isCreating ? (
          <>
            <div className="spinner w-4 h-4"></div>
            Creating...
          </>
        ) : (
          <>
            Create Report
            <Icons.ArrowRight />
          </>
        )}
      </button>
    </div>
  );
}

export default function PackageCatalog({ onImportSuccess }: PackageCatalogProps) {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegulation, setSelectedRegulation] = useState('All');
  const [creatingPackageId, setCreatingPackageId] = useState<string | null>(null);

  // Create report from package
  const createReportMutation = useMutation(
    async (pkg: RegulationPackage) => {
      setCreatingPackageId(pkg.package_id);

      // Create report configuration from package
      const config = {
        mode: 'package',
        package_id: pkg.package_id,
        regulation: pkg.regulation_code,
        output_format: pkg.output_format.toLowerCase().includes('xml') ? 'xml' : 'json',
        fields: pkg.fields.map(f => ({
          field_id: f.field_id,
          field_name: f.field_name,
          data_type: f.data_type,
          requirement: f.requirement,
          cdm_path: f.cdm_path,
          xml_element: f.xml_element,
        })),
        validation_rules: pkg.validation_rules.map(r => r.rule_id),
        schema: {
          namespace: pkg.output_namespace,
          root_element: pkg.output_root_element,
        }
      };

      return reportsAPI.create({
        name: `${pkg.regulation_code} Report`,
        description: `${pkg.regulation_name} - ${pkg.version}. ${pkg.description}`,
        config
      });
    },
    {
      onSuccess: (_, pkg) => {
        queryClient.invalidateQueries('reports');
        showSuccess(
          'Report Created',
          `${pkg.regulation_code} report has been created successfully.`
        );
        setCreatingPackageId(null);
        onImportSuccess?.();
      },
      onError: (error: any, pkg) => {
        showError(
          'Failed to create report',
          error?.response?.data?.detail || 'Please try again.'
        );
        setCreatingPackageId(null);
      }
    }
  );

  // Filter packages
  const filteredPackages = ALL_PACKAGES.filter(pkg => {
    // Filter by regulation
    if (selectedRegulation !== 'All' && pkg.regulation_code !== selectedRegulation) {
      return false;
    }
    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        pkg.regulation_code.toLowerCase().includes(search) ||
        pkg.regulation_name.toLowerCase().includes(search) ||
        pkg.description.toLowerCase().includes(search) ||
        pkg.tags.some(t => t.toLowerCase().includes(search))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
        <div className="flex-shrink-0 w-5 h-5 text-blue-600 mt-0.5">
          <Icons.Check />
        </div>
        <div>
          <p className="text-sm text-blue-800">
            <strong>Pre-built regulatory packages</strong> — Select a package to create a report with all required fields, validation rules, and CDM mappings pre-configured.
          </p>
        </div>
      </div>

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
            placeholder="Search packages..."
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

      {/* Packages grid */}
      {filteredPackages.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchTerm
              ? 'No packages match your search'
              : 'No packages available'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map(pkg => (
            <PackageCard
              key={pkg.package_id}
              pkg={pkg}
              onSelect={(p) => createReportMutation.mutate(p)}
              isCreating={creatingPackageId === pkg.package_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
