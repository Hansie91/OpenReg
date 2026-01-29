import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { validationsAPI, reportsAPI } from '../services/api';
import { useToast } from '../store/toastStore';
import { LoadingState } from './LoadingState';

interface ValidationRule {
    id: string;
    name: string;
    description: string;
    rule_type: string;
    severity: string;
}

interface ValidationRuleSelectorProps {
    reportId: string;
    versionId: string;
    selectedRuleIds: string[];
    recommendedRules?: string[];
    onSave?: () => void;
}

// Icons
const Icons = {
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
    ),
    Search: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
    ),
    Save: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
};

export default function ValidationRuleSelector({
    reportId,
    versionId,
    selectedRuleIds,
    recommendedRules = [],
    onSave
}: ValidationRuleSelectorProps) {
    const queryClient = useQueryClient();
    const { showSuccess, showError } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set(selectedRuleIds));
    const [isDirty, setIsDirty] = useState(false);

    // Fetch all validation rules
    const { data: rules, isLoading } = useQuery('validations', () =>
        validationsAPI.list().then(res => res.data.validation_rules || res.data || [])
    );

    // Sync with external selectedRuleIds
    useEffect(() => {
        setSelected(new Set(selectedRuleIds));
        setIsDirty(false);
    }, [selectedRuleIds]);

    // Save mutation
    const saveMutation = useMutation(
        async () => {
            // Get current version to preserve other config
            const versionRes = await reportsAPI.getVersion(reportId, versionId);
            const currentConfig = versionRes.data.config || {};

            return reportsAPI.updateVersion(reportId, versionId, {
                config: {
                    ...currentConfig,
                    validation_rule_ids: Array.from(selected)
                }
            });
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['report', reportId]);
                queryClient.invalidateQueries(['report-version', reportId, versionId]);
                showSuccess('Validation rules saved successfully');
                setIsDirty(false);
                onSave?.();
            },
            onError: (error: any) => {
                showError('Failed to save validation rules', error?.response?.data?.detail || 'Please try again');
            }
        }
    );

    const toggleRule = (ruleId: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(ruleId)) {
            newSelected.delete(ruleId);
        } else {
            newSelected.add(ruleId);
        }
        setSelected(newSelected);
        setIsDirty(true);
    };

    const selectRecommended = () => {
        if (!rules) return;
        const recommendedIds = rules
            .filter((r: ValidationRule) => recommendedRules.includes(r.name))
            .map((r: ValidationRule) => r.id);
        const newSelected = new Set([...selected, ...recommendedIds]);
        setSelected(newSelected);
        setIsDirty(true);
    };

    if (isLoading) {
        return <LoadingState message="Loading validation rules..." />;
    }

    // Filter rules by search term
    const filteredRules = (rules || []).filter((rule: ValidationRule) =>
        rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group rules by severity
    const rulesBySeverity: Record<string, ValidationRule[]> = {};
    filteredRules.forEach((rule: ValidationRule) => {
        const severity = rule.severity || 'INFO';
        if (!rulesBySeverity[severity]) {
            rulesBySeverity[severity] = [];
        }
        rulesBySeverity[severity].push(rule);
    });

    const severityOrder = ['ERROR', 'WARNING', 'INFO'];
    const severityColors: Record<string, string> = {
        ERROR: 'text-red-600 bg-red-50 border-red-200',
        WARNING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        INFO: 'text-blue-600 bg-blue-50 border-blue-200'
    };

    return (
        <div className="space-y-4">
            {/* Header with search and save */}
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">
                    Validation Rules
                    <span className="ml-2 text-sm font-normal text-gray-500">
                        ({selected.size} selected)
                    </span>
                </h3>

                <div className="flex items-center gap-3">
                    {recommendedRules.length > 0 && (
                        <button
                            onClick={selectRecommended}
                            className="btn btn-secondary btn-sm"
                        >
                            Add Recommended
                        </button>
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

            {/* Search */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Icons.Search />
                </div>
                <input
                    type="text"
                    className="input pl-10"
                    placeholder="Search validation rules..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Rules list by severity */}
            <div className="space-y-4 max-h-96 overflow-auto">
                {severityOrder.map(severity => {
                    const rulesInGroup = rulesBySeverity[severity] || [];
                    if (rulesInGroup.length === 0) return null;

                    return (
                        <div key={severity}>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                                {severity} ({rulesInGroup.length})
                            </h4>
                            <div className="space-y-2">
                                {rulesInGroup.map((rule: ValidationRule) => {
                                    const isSelected = selected.has(rule.id);
                                    const isRecommended = recommendedRules.includes(rule.name);

                                    return (
                                        <label
                                            key={rule.id}
                                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                isSelected
                                                    ? severityColors[severity]
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex-shrink-0 mt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleRule(rule.id)}
                                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">{rule.name}</span>
                                                    <span className="badge badge-gray text-xs">{rule.rule_type}</span>
                                                    {isRecommended && (
                                                        <span className="badge badge-info text-xs">Recommended</span>
                                                    )}
                                                </div>
                                                {rule.description && (
                                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                        {rule.description}
                                                    </p>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {filteredRules.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        {searchTerm ? 'No rules match your search' : 'No validation rules available'}
                    </div>
                )}
            </div>
        </div>
    );
}
