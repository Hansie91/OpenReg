import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Shield,
  CheckCircle,
  ChevronRight,
  Search,
  Tag,
  Calendar,
  Building2,
  Globe,
  Layers,
} from 'lucide-react';
import { getPackageSummaries } from '../data/regulationPackages';

// Get packages from bundled data (open source core)
const packages = getPackageSummaries();

// Type for package summary
type PackageSummary = ReturnType<typeof getPackageSummaries>[0];

// Regulation icons and colors
const regulationConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
  EMIR: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: <Shield className="h-6 w-6" />,
  },
  MIFIR: {
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    icon: <FileText className="h-6 w-6" />,
  },
  SFTR: {
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    icon: <Layers className="h-6 w-6" />,
  },
};

function PackageCard({ pkg }: { pkg: PackageSummary }) {
  const navigate = useNavigate();
  const config = regulationConfig[pkg.regulation_code] || {
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: <FileText className="h-6 w-6" />,
  };

  return (
    <div
      className={`border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer ${config.bgColor}`}
      onClick={() => navigate(`/packages/${pkg.package_id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white ${config.color}`}>
            {config.icon}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{pkg.regulation_code}</h3>
            <p className="text-sm text-gray-500">{pkg.version}</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>

      {/* Title & Description */}
      <h4 className="font-medium text-gray-900 mb-2">{pkg.regulation_name}</h4>
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pkg.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{pkg.field_count}</div>
          <div className="text-xs text-gray-500">Fields</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{pkg.mandatory_fields}</div>
          <div className="text-xs text-gray-500">Mandatory</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{pkg.validation_rule_count}</div>
          <div className="text-xs text-gray-500">Rules</div>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-gray-600">
          <Globe className="h-3 w-3" />
          {pkg.jurisdiction}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-gray-600">
          <Building2 className="h-3 w-3" />
          {pkg.reporting_authority}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-gray-600">
          <Calendar className="h-3 w-3" />
          {pkg.effective_date}
        </span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {pkg.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/50 rounded text-xs text-gray-500"
          >
            <Tag className="h-3 w-3" />
            {tag}
          </span>
        ))}
        {pkg.tags.length > 4 && (
          <span className="text-xs text-gray-400">+{pkg.tags.length - 4} more</span>
        )}
      </div>
    </div>
  );
}

function ComparisonTable({ packages }: { packages: PackageSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Regulation
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Version
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Fields
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Mandatory
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Conditional
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Optional
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Validation Rules
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Output Format
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {packages.map((pkg) => {
            const config = regulationConfig[pkg.regulation_code] || { color: 'text-gray-600' };
            return (
              <tr key={pkg.package_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${config.color}`}>{pkg.regulation_code}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {pkg.version}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  {pkg.field_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                    {pkg.mandatory_fields}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                    {pkg.conditional_fields}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                    {pkg.optional_fields}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                  {pkg.validation_rule_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {pkg.output_format}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Link
                    to={`/packages/${pkg.package_id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View Details
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RegulationPackages() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPackages = packages.filter((pkg) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      pkg.regulation_code.toLowerCase().includes(search) ||
      pkg.regulation_name.toLowerCase().includes(search) ||
      pkg.description.toLowerCase().includes(search) ||
      pkg.tags.some((tag) => tag.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regulation Packages</h1>
          <p className="text-gray-500 mt-1">
            Pre-built packages for EMIR, MiFIR, and SFTR regulatory reporting
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Open Source Regulatory Templates</h3>
            <p className="text-sm text-blue-700 mt-1">
              Each package includes field specifications, validation rules, and mappings to the
              ISDA/FINOS Common Domain Model (CDM). These templates are bundled with the application and available offline.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-lg ${
              viewMode === 'cards' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg ${
              viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => (
            <PackageCard key={pkg.package_id} pkg={pkg} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <ComparisonTable packages={filteredPackages} />
        </div>
      )}

      {/* Empty State */}
      {filteredPackages.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No packages found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search terms.
          </p>
        </div>
      )}
    </div>
  );
}
