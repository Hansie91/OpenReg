import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { externalAPIService } from '../services/api';
import { useApiError } from '../hooks/useApiError';
import { useToast } from '../store/toastStore';
import { LoadingState } from '../components/LoadingState';

// Icons
const Icons = {
    Key: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
        </svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
    ),
    Sync: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
    ),
    Clock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    Warning: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
    ),
    Disconnect: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
};

// Types
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

interface ConnectionStatus {
    connected: boolean;
    config_id: string | null;
    last_sync_at: string | null;
    last_sync_status: string | null;
}

type TabType = 'status' | 'history' | 'conflicts';

export default function ExternalAPI() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabType>('status');
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const { handleError } = useApiError();
    const { showWarning, showSuccess } = useToast();

    // Check connection status
    const { data: connectionStatus, isLoading: connectionLoading } = useQuery<ConnectionStatus>(
        'external-api-connection',
        () => externalAPIService.getConnectionStatus().then(res => res.data),
        { retry: false }
    );

    // Queries for connected state
    const { data: syncStatus, isLoading: statusLoading } = useQuery(
        'external-api-sync-status',
        () => externalAPIService.getSyncStatus().then(res => res.data),
        {
            enabled: connectionStatus?.connected === true,
            refetchInterval: 30000
        }
    );

    const { data: conflicts, isLoading: conflictsLoading } = useQuery(
        'external-api-conflicts',
        () => externalAPIService.listConflicts().then(res => res.data),
        { enabled: connectionStatus?.connected === true }
    );

    const { data: syncHistory, isLoading: historyLoading } = useQuery(
        'external-api-sync-history',
        () => connectionStatus?.config_id
            ? externalAPIService.getSyncHistory(connectionStatus.config_id).then(res => res.data)
            : Promise.resolve([]),
        { enabled: connectionStatus?.connected === true && !!connectionStatus?.config_id }
    );

    // Connect mutation
    const connectMutation = useMutation(
        (key: string) => externalAPIService.connect(key),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('external-api-connection');
                queryClient.invalidateQueries('external-api-sync-status');
                setApiKey('');
                showSuccess('Connected', 'Successfully connected to the regulatory API.');
            },
            onError: (err: unknown) => {
                handleError(err);
            }
        }
    );

    // Disconnect mutation
    const disconnectMutation = useMutation(
        () => externalAPIService.disconnect(),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('external-api-connection');
                queryClient.invalidateQueries('external-api-sync-status');
                showSuccess('Disconnected', 'Successfully disconnected from the regulatory API.');
            },
            onError: (err: unknown) => {
                handleError(err);
            }
        }
    );

    // Sync mutation
    const syncMutation = useMutation(
        () => connectionStatus?.config_id
            ? externalAPIService.triggerSync(connectionStatus.config_id, 'differential')
            : Promise.reject('No config'),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('external-api-sync-status');
                queryClient.invalidateQueries('external-api-sync-history');
                showSuccess('Sync Started', 'Synchronization has been triggered.');
            },
            onError: (err: unknown) => {
                handleError(err);
            }
        }
    );

    // Resolve conflict mutation
    const resolveConflictMutation = useMutation(
        ({ entityType, entityId, resolution }: { entityType: string; entityId: string; resolution: string }) =>
            externalAPIService.resolveConflict(entityType, entityId, resolution),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('external-api-conflicts');
                queryClient.invalidateQueries('external-api-sync-status');
                showSuccess('Conflict Resolved', 'The conflict has been resolved successfully.');
            },
            onError: (err: unknown) => {
                handleError(err);
            }
        }
    );

    const handleConnect = () => {
        if (!apiKey.trim()) {
            showWarning('API Key Required', 'Please enter your API key to connect.');
            return;
        }
        connectMutation.mutate(apiKey);
    };

    const tabs = [
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

    const isConnected = connectionStatus?.connected === true;

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="mb-4">
                <h1 className="text-base font-semibold text-gray-900">Connect API</h1>
                <p className="text-xs text-gray-500">
                    Connect to the regulatory API to sync reports, validations, and reference data
                </p>
            </div>

            {/* Connection Card */}
            <div className="card p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Icons.Key />
                        </div>
                        <div>
                            <h2 className="text-sm font-medium text-gray-900">
                                {isConnected ? 'Connected' : 'Not Connected'}
                            </h2>
                            {isConnected && connectionStatus?.last_sync_at && (
                                <p className="text-xs text-gray-500">
                                    Last sync: {formatDate(connectionStatus.last_sync_at)}
                                </p>
                            )}
                        </div>
                    </div>

                    {isConnected ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => syncMutation.mutate()}
                                disabled={syncMutation.isLoading}
                                className="btn btn-primary btn-sm"
                            >
                                <Icons.Sync />
                                <span className="ml-1">{syncMutation.isLoading ? 'Syncing...' : 'Sync Now'}</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('Are you sure you want to disconnect?')) {
                                        disconnectMutation.mutate();
                                    }
                                }}
                                disabled={disconnectMutation.isLoading}
                                className="btn btn-ghost btn-sm text-red-600"
                            >
                                <Icons.Disconnect />
                                <span className="ml-1">Disconnect</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter your API key"
                                    className="input input-sm w-64 pr-16"
                                    onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                                >
                                    {showApiKey ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            <button
                                onClick={handleConnect}
                                disabled={connectMutation.isLoading || !apiKey.trim()}
                                className="btn btn-primary btn-sm"
                            >
                                {connectMutation.isLoading ? 'Connecting...' : 'Connect'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Only show tabs and content when connected */}
            {isConnected && (
                <>
                    {/* Tabs */}
                    <div className="flex gap-1 mb-4 border-b border-gray-200">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                                        activeTab === tab.id
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Icon />
                                    {tab.label}
                                    {tab.badge && tab.badge > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sync Status Tab */}
                    {activeTab === 'status' && (
                        <div>
                            {statusLoading ? (
                                <LoadingState message="Loading sync status..." />
                            ) : syncStatus ? (
                                <div className="grid grid-cols-4 gap-3">
                                    {/* Reports */}
                                    <div className="card p-4">
                                        <h3 className="text-xs font-medium text-gray-500 mb-2">Reports</h3>
                                        <p className="text-xl font-bold text-gray-900">{syncStatus.total_reports}</p>
                                        <div className="mt-3 space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Synced</span>
                                                <span className="text-emerald-600">{syncStatus.synced_reports}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Modified</span>
                                                <span className="text-amber-600">{syncStatus.modified_reports}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Conflicts</span>
                                                <span className="text-red-600">{syncStatus.conflict_reports}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Validations */}
                                    <div className="card p-4">
                                        <h3 className="text-xs font-medium text-gray-500 mb-2">Validations</h3>
                                        <p className="text-xl font-bold text-gray-900">{syncStatus.total_validations}</p>
                                        <div className="mt-3 space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Synced</span>
                                                <span className="text-emerald-600">{syncStatus.synced_validations}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Modified</span>
                                                <span className="text-amber-600">{syncStatus.modified_validations}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Conflicts</span>
                                                <span className="text-red-600">{syncStatus.conflict_validations}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reference Data */}
                                    <div className="card p-4">
                                        <h3 className="text-xs font-medium text-gray-500 mb-2">Reference Data</h3>
                                        <p className="text-xl font-bold text-gray-900">{syncStatus.total_reference_data}</p>
                                        <div className="mt-3 space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Synced</span>
                                                <span className="text-emerald-600">{syncStatus.synced_reference_data}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Modified</span>
                                                <span className="text-amber-600">{syncStatus.modified_reference_data}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Conflicts</span>
                                                <span className="text-red-600">{syncStatus.conflict_reference_data}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Schedules */}
                                    <div className="card p-4">
                                        <h3 className="text-xs font-medium text-gray-500 mb-2">Schedules</h3>
                                        <p className="text-xl font-bold text-gray-900">{syncStatus.total_schedules}</p>
                                        <div className="mt-3 space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Synced</span>
                                                <span className="text-emerald-600">{syncStatus.synced_schedules}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Modified</span>
                                                <span className="text-amber-600">{syncStatus.modified_schedules}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Conflicts</span>
                                                <span className="text-red-600">{syncStatus.conflict_schedules}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <h3 className="empty-state-title">No sync data</h3>
                                    <p className="empty-state-description">Click "Sync Now" to fetch data from the API</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <div>
                            {historyLoading ? (
                                <LoadingState message="Loading sync history..." />
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
                                                        <div className="text-xs space-y-0.5">
                                                            <div>Fetched: {log.items_fetched}</div>
                                                            <div>Created: {log.reports_created + log.validations_created + log.reference_data_created + log.schedules_created}</div>
                                                            <div>Updated: {log.reports_updated + log.validations_updated + log.reference_data_updated + log.schedules_updated}</div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${
                                                            log.status === 'success' ? 'badge-success' :
                                                            log.status === 'failed' ? 'badge-error' :
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
                                    <div className="empty-state-icon"><Icons.Clock /></div>
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
                            {conflictsLoading ? (
                                <LoadingState message="Loading conflicts..." />
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
                                                    <td className="text-gray-500 font-mono">{conflict.external_id}</td>
                                                    <td>{conflict.upstream_version || '-'}</td>
                                                    <td className="text-gray-500">{formatDate(conflict.forked_at)}</td>
                                                    <td>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => resolveConflictMutation.mutate({
                                                                    entityType: conflict.entity_type,
                                                                    entityId: conflict.id,
                                                                    resolution: 'keep_local'
                                                                })}
                                                                className="btn btn-secondary btn-xs"
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
                                                                className="btn btn-primary btn-xs"
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
                                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Icons.Check />
                                    </div>
                                    <h3 className="empty-state-title">No conflicts</h3>
                                    <p className="empty-state-description">
                                        All synced items are up to date
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Help text when not connected */}
            {!isConnected && !connectionLoading && (
                <div className="card p-4 bg-gray-50 border-dashed">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Getting Started</h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Enter your API key to connect to the regulatory data service. Once connected, you can sync reports,
                        validation rules, reference data, and schedules.
                    </p>
                    <p className="text-xs text-gray-500">
                        Don't have an API key? Contact your administrator or visit the customer portal to obtain one.
                    </p>
                </div>
            )}
        </div>
    );
}
