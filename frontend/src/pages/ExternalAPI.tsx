import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { externalAPIService } from '../services/api';

// Icons
const Icons = {
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    Cloud: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
        </svg>
    ),
    Sync: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
    ),
    Clock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    Warning: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
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
    Play: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
    ),
    Upload: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
    ),
};

// Types
interface APIConfig {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    api_base_url: string;
    api_version: string | null;
    auth_type: string;
    rate_limit_per_minute: number;
    cache_ttl_seconds: number;
    sync_schedule: string | null;
    auto_sync_enabled: boolean;
    schema_mapping: Record<string, any>;
    is_active: boolean;
    last_sync_at: string | null;
    last_sync_status: string | null;
    last_sync_message: string | null;
    created_at: string;
    updated_at: string;
}

interface SyncHistory {
    id: string;
    sync_type: string;
    triggered_by: string;
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    status: string;
    items_fetched: number;
    reports_created: number;
    reports_updated: number;
    validations_created: number;
    validations_updated: number;
    reference_data_created: number;
    reference_data_updated: number;
    schedules_created: number;
    schedules_updated: number;
    conflicts_detected: number;
    error_message: string | null;
}

interface Conflict {
    entity_type: string;
    id: string;
    external_id: string;
    name: string;
    upstream_version: string | null;
    forked_at: string | null;
}

interface SyncStatus {
    total_reports: number;
    synced_reports: number;
    modified_reports: number;
    conflict_reports: number;
    total_validations: number;
    synced_validations: number;
    modified_validations: number;
    conflict_validations: number;
    total_reference_data: number;
    synced_reference_data: number;
    modified_reference_data: number;
    conflict_reference_data: number;
    total_schedules: number;
    synced_schedules: number;
    modified_schedules: number;
    conflict_schedules: number;
}

type TabType = 'configs' | 'status' | 'history' | 'conflicts';

export default function ExternalAPI() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabType>('configs');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedConfig, setSelectedConfig] = useState<APIConfig | null>(null);
    const [selectedHistoryConfig, setSelectedHistoryConfig] = useState<string | null>(null);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncMode, setSyncMode] = useState<'differential' | 'full'>('differential');
    const [showImportModal, setShowImportModal] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        api_base_url: '',
        api_version: '',
        auth_type: 'api_key',
        credentials: {} as Record<string, string>,
        rate_limit_per_minute: 60,
        cache_ttl_seconds: 3600,
        sync_schedule: '0 2 * * *',
        auto_sync_enabled: true,
    });

    // Queries
    const { data: configs, isLoading: configsLoading } = useQuery(
        'external-api-configs',
        () => externalAPIService.listConfigs().then(res => res.data)
    );

    const { data: syncStatus, isLoading: statusLoading } = useQuery(
        'external-api-sync-status',
        () => externalAPIService.getSyncStatus().then(res => res.data),
        { refetchInterval: 30000 }
    );

    const { data: conflicts, isLoading: conflictsLoading } = useQuery(
        'external-api-conflicts',
        () => externalAPIService.listConflicts().then(res => res.data)
    );

    const { data: syncHistory, isLoading: historyLoading } = useQuery(
        ['external-api-sync-history', selectedHistoryConfig],
        () => selectedHistoryConfig
            ? externalAPIService.getSyncHistory(selectedHistoryConfig).then(res => res.data)
            : Promise.resolve([]),
        { enabled: !!selectedHistoryConfig }
    );

    // Mutations
    const createConfigMutation = useMutation(
        (data: any) => externalAPIService.createConfig(data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('external-api-configs');
                setShowCreateModal(false);
                resetForm();
                alert('API configuration created successfully');
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to create configuration');
            }
        }
    );

    const updateConfigMutation = useMutation(
        ({ id, data }: { id: string; data: any }) => externalAPIService.updateConfig(id, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('external-api-configs');
                setShowEditModal(false);
                setSelectedConfig(null);
                alert('Configuration updated successfully');
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to update configuration');
            }
        }
    );

    const deleteConfigMutation = useMutation(
        (id: string) => externalAPIService.deleteConfig(id),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('external-api-configs');
                setShowDeleteConfirm(false);
                setSelectedConfig(null);
                alert('Configuration deleted successfully');
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to delete configuration');
            }
        }
    );

    const testConnectionMutation = useMutation(
        (id: string) => externalAPIService.testConnection(id),
        {
            onSuccess: (response) => {
                if (response.data.success) {
                    alert(`Connection successful! Response time: ${response.data.response_time_ms}ms`);
                } else {
                    alert(`Connection failed: ${response.data.error}`);
                }
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Connection test failed');
            }
        }
    );

    const triggerSyncMutation = useMutation(
        ({ id, mode }: { id: string; mode: string }) => externalAPIService.triggerSync(id, mode),
        {
            onSuccess: (response) => {
                queryClient.invalidateQueries('external-api-configs');
                queryClient.invalidateQueries('external-api-sync-status');
                setShowSyncModal(false);
                alert(`Sync triggered! Task ID: ${response.data.task_id}`);
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to trigger sync');
            }
        }
    );

    const resolveConflictMutation = useMutation(
        ({ entityType, entityId, resolution }: { entityType: string; entityId: string; resolution: string }) =>
            externalAPIService.resolveConflict(entityType, entityId, resolution),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('external-api-conflicts');
                queryClient.invalidateQueries('external-api-sync-status');
                alert('Conflict resolved successfully');
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to resolve conflict');
            }
        }
    );

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            api_base_url: '',
            api_version: '',
            auth_type: 'api_key',
            credentials: {},
            rate_limit_per_minute: 60,
            cache_ttl_seconds: 3600,
            sync_schedule: '0 2 * * *',
            auto_sync_enabled: true,
        });
    };

    const handleEditConfig = (config: APIConfig) => {
        setSelectedConfig(config);
        setFormData({
            name: config.name,
            description: config.description || '',
            api_base_url: config.api_base_url,
            api_version: config.api_version || '',
            auth_type: config.auth_type,
            credentials: {},
            rate_limit_per_minute: config.rate_limit_per_minute,
            cache_ttl_seconds: config.cache_ttl_seconds,
            sync_schedule: config.sync_schedule || '0 2 * * *',
            auto_sync_enabled: config.auto_sync_enabled,
        });
        setShowEditModal(true);
    };

    const tabs = [
        { id: 'configs' as TabType, label: 'Configurations', icon: Icons.Cloud },
        { id: 'status' as TabType, label: 'Sync Status', icon: Icons.Sync },
        { id: 'history' as TabType, label: 'History', icon: Icons.Clock },
        { id: 'conflicts' as TabType, label: 'Conflicts', icon: Icons.Warning, badge: conflicts?.length },
    ];

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    const formatDuration = (ms: number | null) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="page-header">
                <h1 className="page-title">External API</h1>
                <p className="page-description">
                    Manage external regulatory API connections and sync regulatory data
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab === tab.id
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Icon />
                            {tab.label}
                            {tab.badge && tab.badge > 0 && (
                                <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Configurations Tab */}
            {activeTab === 'configs' && (
                <div>
                    <div className="flex justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">API Configurations</h2>
                        <div className="flex gap-2">
                            <button onClick={() => setShowImportModal(true)} className="btn btn-secondary">
                                <Icons.Upload />
                                <span className="ml-2">Import JSON</span>
                            </button>
                            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                                <Icons.Plus />
                                <span className="ml-2">Add Configuration</span>
                            </button>
                        </div>
                    </div>

                    {configsLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : configs && configs.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {configs.map((config: APIConfig) => (
                                <div key={config.id} className="card p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{config.name}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{config.api_base_url}</p>
                                        </div>
                                        <span className={`badge ${config.is_active ? 'badge-success' : 'badge-gray'}`}>
                                            {config.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>

                                    {config.description && (
                                        <p className="text-sm text-gray-600 mb-4">{config.description}</p>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                        <div>
                                            <span className="text-gray-500">Auth Type:</span>
                                            <span className="ml-2 font-medium">{config.auth_type}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Schedule:</span>
                                            <span className="ml-2 font-medium">{config.sync_schedule || 'Manual'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Last Sync:</span>
                                            <span className="ml-2">{formatDate(config.last_sync_at)}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Status:</span>
                                            <span className={`ml-2 ${config.last_sync_status === 'success' ? 'text-green-600' : config.last_sync_status === 'failed' ? 'text-red-600' : 'text-gray-600'}`}>
                                                {config.last_sync_status || 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                                        <button
                                            onClick={() => {
                                                setSelectedConfig(config);
                                                setShowSyncModal(true);
                                            }}
                                            className="btn btn-primary btn-sm flex-1"
                                            disabled={!config.is_active}
                                        >
                                            <Icons.Play />
                                            <span className="ml-1">Sync</span>
                                        </button>
                                        <button
                                            onClick={() => testConnectionMutation.mutate(config.id)}
                                            className="btn btn-secondary btn-sm"
                                            disabled={testConnectionMutation.isLoading}
                                        >
                                            Test
                                        </button>
                                        <button
                                            onClick={() => handleEditConfig(config)}
                                            className="btn btn-ghost btn-icon"
                                        >
                                            <Icons.Edit />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedConfig(config);
                                                setShowDeleteConfirm(true);
                                            }}
                                            className="btn btn-ghost btn-icon text-red-600"
                                        >
                                            <Icons.Trash />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="text-gray-300 mx-auto">
                                <Icons.Cloud />
                            </div>
                            <h3 className="empty-state-title">No API configurations</h3>
                            <p className="empty-state-description">
                                Connect to an external regulatory API to sync reports, validations, and reference data
                            </p>
                            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary mt-4">
                                <Icons.Plus />
                                <span className="ml-2">Add Configuration</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Sync Status Tab */}
            {activeTab === 'status' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Sync Status</h2>
                        <p className="text-sm text-gray-500">Overview of synced items across all entity types</p>
                    </div>

                    {statusLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : syncStatus ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Reports */}
                            <div className="card p-6">
                                <h3 className="text-sm font-medium text-gray-500 mb-4">Reports</h3>
                                <p className="text-3xl font-bold text-gray-900">{syncStatus.total_reports}</p>
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Synced</span>
                                        <span className="text-green-600">{syncStatus.synced_reports}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Modified</span>
                                        <span className="text-amber-600">{syncStatus.modified_reports}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Conflicts</span>
                                        <span className="text-red-600">{syncStatus.conflict_reports}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Validations */}
                            <div className="card p-6">
                                <h3 className="text-sm font-medium text-gray-500 mb-4">Validation Rules</h3>
                                <p className="text-3xl font-bold text-gray-900">{syncStatus.total_validations}</p>
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Synced</span>
                                        <span className="text-green-600">{syncStatus.synced_validations}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Modified</span>
                                        <span className="text-amber-600">{syncStatus.modified_validations}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Conflicts</span>
                                        <span className="text-red-600">{syncStatus.conflict_validations}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Reference Data */}
                            <div className="card p-6">
                                <h3 className="text-sm font-medium text-gray-500 mb-4">Reference Data</h3>
                                <p className="text-3xl font-bold text-gray-900">{syncStatus.total_reference_data}</p>
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Synced</span>
                                        <span className="text-green-600">{syncStatus.synced_reference_data}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Modified</span>
                                        <span className="text-amber-600">{syncStatus.modified_reference_data}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Conflicts</span>
                                        <span className="text-red-600">{syncStatus.conflict_reference_data}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Schedules */}
                            <div className="card p-6">
                                <h3 className="text-sm font-medium text-gray-500 mb-4">Schedules</h3>
                                <p className="text-3xl font-bold text-gray-900">{syncStatus.total_schedules}</p>
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Synced</span>
                                        <span className="text-green-600">{syncStatus.synced_schedules}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Modified</span>
                                        <span className="text-amber-600">{syncStatus.modified_schedules}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Conflicts</span>
                                        <span className="text-red-600">{syncStatus.conflict_schedules}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <h3 className="empty-state-title">No sync data</h3>
                        </div>
                    )}
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Sync History</h2>
                        <p className="text-sm text-gray-500">View past synchronization operations</p>
                    </div>

                    {/* Config selector */}
                    <div className="card p-4 mb-6">
                        <label className="input-label">Select Configuration</label>
                        <select
                            className="select"
                            value={selectedHistoryConfig || ''}
                            onChange={(e) => setSelectedHistoryConfig(e.target.value || null)}
                        >
                            <option value="">Select a configuration...</option>
                            {configs?.map((config: APIConfig) => (
                                <option key={config.id} value={config.id}>{config.name}</option>
                            ))}
                        </select>
                    </div>

                    {!selectedHistoryConfig ? (
                        <div className="empty-state">
                            <Icons.Clock />
                            <h3 className="empty-state-title">Select a configuration</h3>
                            <p className="empty-state-description">
                                Choose an API configuration to view its sync history
                            </p>
                        </div>
                    ) : historyLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : syncHistory && syncHistory.length > 0 ? (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Started</th>
                                        <th>Type</th>
                                        <th>Triggered By</th>
                                        <th>Duration</th>
                                        <th>Items</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {syncHistory.map((log: SyncHistory) => (
                                        <tr key={log.id}>
                                            <td className="text-gray-600">
                                                {formatDate(log.started_at)}
                                            </td>
                                            <td>
                                                <span className="badge badge-info">{log.sync_type}</span>
                                            </td>
                                            <td className="capitalize">{log.triggered_by}</td>
                                            <td>{formatDuration(log.duration_ms)}</td>
                                            <td>
                                                <div className="text-xs space-y-1">
                                                    <div>Fetched: {log.items_fetched}</div>
                                                    <div>Created: {log.reports_created + log.validations_created + log.reference_data_created + log.schedules_created}</div>
                                                    <div>Updated: {log.reports_updated + log.validations_updated + log.reference_data_updated + log.schedules_updated}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${log.status === 'success' ? 'badge-success' :
                                                    log.status === 'failed' ? 'badge-danger' :
                                                        log.status === 'running' ? 'badge-info' : 'badge-gray'
                                                    }`}>
                                                    {log.status}
                                                </span>
                                                {log.conflicts_detected > 0 && (
                                                    <span className="badge badge-warning ml-1">
                                                        {log.conflicts_detected} conflicts
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Icons.Clock />
                            <h3 className="empty-state-title">No sync history</h3>
                            <p className="empty-state-description">
                                No synchronization operations have been performed yet
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Conflicts Tab */}
            {activeTab === 'conflicts' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Sync Conflicts</h2>
                        <p className="text-sm text-gray-500">
                            Items that have been modified locally and upstream. Choose which version to keep.
                        </p>
                    </div>

                    {conflictsLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : conflicts && conflicts.length > 0 ? (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Entity</th>
                                        <th>Name</th>
                                        <th>External ID</th>
                                        <th>Upstream Version</th>
                                        <th>Forked At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {conflicts.map((conflict: Conflict) => (
                                        <tr key={`${conflict.entity_type}-${conflict.id}`}>
                                            <td>
                                                <span className="badge badge-gray capitalize">{conflict.entity_type.replace('_', ' ')}</span>
                                            </td>
                                            <td className="font-medium text-gray-900">{conflict.name}</td>
                                            <td className="text-gray-500 font-mono text-sm">{conflict.external_id}</td>
                                            <td>{conflict.upstream_version || '-'}</td>
                                            <td className="text-gray-500">{formatDate(conflict.forked_at)}</td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => resolveConflictMutation.mutate({
                                                            entityType: conflict.entity_type,
                                                            entityId: conflict.id,
                                                            resolution: 'keep_local'
                                                        })}
                                                        className="btn btn-secondary btn-sm"
                                                        disabled={resolveConflictMutation.isLoading}
                                                    >
                                                        Keep Local
                                                    </button>
                                                    <button
                                                        onClick={() => resolveConflictMutation.mutate({
                                                            entityType: conflict.entity_type,
                                                            entityId: conflict.id,
                                                            resolution: 'take_upstream'
                                                        })}
                                                        className="btn btn-primary btn-sm"
                                                        disabled={resolveConflictMutation.isLoading}
                                                    >
                                                        Take Upstream
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icons.Check />
                            </div>
                            <h3 className="empty-state-title">No conflicts</h3>
                            <p className="empty-state-description">
                                All synced items are up to date with no conflicts
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="modal-overlay" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{showEditModal ? 'Edit' : 'Add'} API Configuration</h3>
                            <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Name *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="My Regulatory API"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">API Version</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="v1"
                                        value={formData.api_version}
                                        onChange={(e) => setFormData({ ...formData, api_version: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="input-label">Base URL *</label>
                                <input
                                    type="url"
                                    className="input"
                                    placeholder="https://api.example.com"
                                    value={formData.api_base_url}
                                    onChange={(e) => setFormData({ ...formData, api_base_url: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    placeholder="Optional description..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Authentication Type</label>
                                    <select
                                        className="select"
                                        value={formData.auth_type}
                                        onChange={(e) => setFormData({ ...formData, auth_type: e.target.value })}
                                    >
                                        <option value="api_key">API Key</option>
                                        <option value="oauth2">OAuth 2.0</option>
                                        <option value="basic">Basic Auth</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label">
                                        {formData.auth_type === 'api_key' ? 'API Key' :
                                            formData.auth_type === 'basic' ? 'Username' : 'Client ID'}
                                    </label>
                                    <input
                                        type="password"
                                        className="input"
                                        placeholder="Enter credentials..."
                                        value={formData.credentials.api_key || formData.credentials.username || formData.credentials.client_id || ''}
                                        onChange={(e) => {
                                            const key = formData.auth_type === 'api_key' ? 'api_key' :
                                                formData.auth_type === 'basic' ? 'username' : 'client_id';
                                            setFormData({
                                                ...formData,
                                                credentials: { ...formData.credentials, [key]: e.target.value }
                                            });
                                        }}
                                    />
                                </div>
                            </div>

                            {(formData.auth_type === 'basic' || formData.auth_type === 'oauth2') && (
                                <div>
                                    <label className="input-label">
                                        {formData.auth_type === 'basic' ? 'Password' : 'Client Secret'}
                                    </label>
                                    <input
                                        type="password"
                                        className="input"
                                        placeholder="Enter secret..."
                                        value={formData.credentials.password || formData.credentials.client_secret || ''}
                                        onChange={(e) => {
                                            const key = formData.auth_type === 'basic' ? 'password' : 'client_secret';
                                            setFormData({
                                                ...formData,
                                                credentials: { ...formData.credentials, [key]: e.target.value }
                                            });
                                        }}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Rate Limit (per minute)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        min={1}
                                        max={1000}
                                        value={formData.rate_limit_per_minute}
                                        onChange={(e) => setFormData({ ...formData, rate_limit_per_minute: parseInt(e.target.value) || 60 })}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Cache TTL (seconds)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        min={0}
                                        value={formData.cache_ttl_seconds}
                                        onChange={(e) => setFormData({ ...formData, cache_ttl_seconds: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="input-label">Sync Schedule (cron expression)</label>
                                <input
                                    type="text"
                                    className="input font-mono"
                                    placeholder="0 2 * * *"
                                    value={formData.sync_schedule}
                                    onChange={(e) => setFormData({ ...formData, sync_schedule: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Examples: 0 2 * * * (daily at 2 AM), 0 */6 * * * (every 6 hours)
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="auto_sync_enabled"
                                    checked={formData.auto_sync_enabled}
                                    onChange={(e) => setFormData({ ...formData, auto_sync_enabled: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="auto_sync_enabled" className="text-sm text-gray-700">
                                    Enable automatic synchronization
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!formData.name || !formData.api_base_url) {
                                        alert('Name and Base URL are required');
                                        return;
                                    }
                                    if (showEditModal && selectedConfig) {
                                        updateConfigMutation.mutate({ id: selectedConfig.id, data: formData });
                                    } else {
                                        createConfigMutation.mutate(formData);
                                    }
                                }}
                                className="btn btn-primary"
                                disabled={createConfigMutation.isLoading || updateConfigMutation.isLoading}
                            >
                                {showEditModal ? 'Save Changes' : 'Create Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sync Modal */}
            {showSyncModal && selectedConfig && (
                <div className="modal-overlay" onClick={() => setShowSyncModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Trigger Sync</h3>
                            <button onClick={() => setShowSyncModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600 mb-4">
                                Sync regulatory data from <strong>{selectedConfig.name}</strong>
                            </p>

                            <div>
                                <label className="input-label">Sync Mode</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="radio"
                                            name="sync_mode"
                                            checked={syncMode === 'differential'}
                                            onChange={() => setSyncMode('differential')}
                                        />
                                        <div>
                                            <p className="font-medium">Differential</p>
                                            <p className="text-sm text-gray-500">Only sync changes since last sync</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="radio"
                                            name="sync_mode"
                                            checked={syncMode === 'full'}
                                            onChange={() => setSyncMode('full')}
                                        />
                                        <div>
                                            <p className="font-medium">Full</p>
                                            <p className="text-sm text-gray-500">Re-sync all data from scratch</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowSyncModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => triggerSyncMutation.mutate({ id: selectedConfig.id, mode: syncMode })}
                                className="btn btn-primary"
                                disabled={triggerSyncMutation.isLoading}
                            >
                                {triggerSyncMutation.isLoading ? 'Starting...' : 'Start Sync'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedConfig && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title text-red-600">Delete Configuration</h3>
                            <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600">
                                Are you sure you want to delete <strong>{selectedConfig.name}</strong>?
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                This will remove the API configuration. Synced items will remain but will no longer be linked to this source.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteConfigMutation.mutate(selectedConfig.id)}
                                className="btn btn-danger"
                                disabled={deleteConfigMutation.isLoading}
                            >
                                {deleteConfigMutation.isLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Import JSON</h3>
                            <button onClick={() => setShowImportModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600 mb-4">
                                Upload a JSON file containing regulatory data (reports, validations, reference data, schedules).
                            </p>
                            <input
                                type="file"
                                accept=".json"
                                className="input"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        try {
                                            const result = await externalAPIService.importJSON(file);
                                            alert(`Parsed: ${result.data.reports_found} reports, ${result.data.validations_found} validations, ${result.data.reference_data_found} reference data, ${result.data.schedules_found} schedules`);
                                            setShowImportModal(false);
                                        } catch (err: any) {
                                            alert(err.response?.data?.detail || 'Failed to import file');
                                        }
                                    }
                                }}
                            />
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowImportModal(false)} className="btn btn-secondary">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
