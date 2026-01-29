import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
    baseURL: `${API_URL}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Queue for requests waiting for token refresh
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token!);
        }
    });
    failedQueue = [];
};

// Refresh the access token using the refresh token
const refreshAccessToken = async (): Promise<string | null> => {
    const state = useAuthStore.getState();
    const refreshToken = state.refreshToken;

    if (!refreshToken) {
        return null;
    }

    try {
        // Use a separate axios instance to avoid interceptors
        const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken
        });

        const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;

        // Update tokens in store
        state.updateTokens(access_token, newRefreshToken, expires_in);

        return access_token;
    } catch (error) {
        // Refresh failed - logout user
        state.logout();
        return null;
    }
};

// Request interceptor - add auth token and check expiry
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const state = useAuthStore.getState();

    // Skip auth for login and refresh endpoints
    const isAuthEndpoint = config.url?.includes('/auth/login') || config.url?.includes('/auth/refresh');
    if (isAuthEndpoint) {
        return config;
    }

    // Check if token exists
    let accessToken = state.accessToken;

    if (!accessToken) {
        return config;
    }

    // Check if token is expiring soon and needs refresh
    if (state.isTokenExpiringSoon(60)) { // Refresh 60 seconds before expiry
        if (!isRefreshing) {
            isRefreshing = true;
            state.setRefreshing(true);

            try {
                accessToken = await refreshAccessToken();
                if (accessToken) {
                    processQueue(null, accessToken);
                } else {
                    processQueue(new Error('Token refresh failed'), null);
                    // Redirect to login
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                    return Promise.reject(new Error('Authentication required'));
                }
            } catch (error) {
                processQueue(error, null);
                return Promise.reject(error);
            } finally {
                isRefreshing = false;
                state.setRefreshing(false);
            }
        } else {
            // Wait for the current refresh to complete
            accessToken = await new Promise<string>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            });
        }
    }

    // Add the access token to the request
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

// Response interceptor - handle 401 errors with retry
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Skip if no config or already retrying
        if (!originalRequest || originalRequest._retry) {
            return Promise.reject(error);
        }

        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
            // Don't retry auth endpoints
            if (originalRequest.url?.includes('/auth/')) {
                const state = useAuthStore.getState();
                state.logout();
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }

            // Try to refresh the token
            if (!isRefreshing) {
                isRefreshing = true;
                originalRequest._retry = true;

                try {
                    const newToken = await refreshAccessToken();
                    if (newToken) {
                        processQueue(null, newToken);
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        return api(originalRequest);
                    }
                } catch (refreshError) {
                    processQueue(refreshError, null);
                } finally {
                    isRefreshing = false;
                }
            } else {
                // Queue this request until refresh completes
                return new Promise((resolve, reject) => {
                    failedQueue.push({
                        resolve: (token: string) => {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                            resolve(api(originalRequest));
                        },
                        reject: (err: any) => reject(err),
                    });
                });
            }

            // Refresh failed - logout
            const state = useAuthStore.getState();
            state.logout();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

// Export a type for structured API errors
export interface APIError {
    status: number;
    code?: string;
    message: string;
    requestId?: string;
}

// Auth API
export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    logout: () => api.post('/auth/logout'),
    getCurrentUser: () => api.get('/auth/me'),
};

// Reports API
export const reportsAPI = {
    list: () => api.get('/reports'),
    get: (id: string) => api.get(`/reports/${id}`),
    create: (data: any) => api.post('/reports', data),
    update: (id: string, data: any) => api.put(`/reports/${id}`, data),
    delete: (id: string) => api.delete(`/reports/${id}`),
    execute: (id: string, params?: any) =>
        api.post(`/reports/${id}/execute`, { parameters: params }),
    // Report Versions
    getVersions: (reportId: string) => api.get(`/reports/${reportId}/versions`),
    getVersion: (reportId: string, versionId: string) =>
        api.get(`/reports/${reportId}/versions/${versionId}`),
    createVersion: (reportId: string, data: any) =>
        api.post(`/reports/${reportId}/versions`, data),
    updateVersion: (reportId: string, versionId: string, data: any) =>
        api.put(`/reports/${reportId}/versions/${versionId}`, data),
    // Execution history and stats
    getExecutions: (reportId: string, params?: any) =>
        api.get(`/reports/${reportId}/executions`, { params }),
    getStats: (reportId: string) => api.get(`/reports/${reportId}/stats`),
};

// Connectors API
export const connectorsAPI = {
    list: () => api.get('/connectors'),
    get: (id: string) => api.get(`/connectors/${id}`),
    create: (data: any) => api.post('/connectors', data),
    update: (id: string, data: any) => api.put(`/connectors/${id}`, data),
    delete: (id: string) => api.delete(`/connectors/${id}`),
    test: (data: any) => api.post('/connectors/test', data),
    testExisting: (id: string) => api.post(`/connectors/${id}/test`),
    // Schema discovery
    getTables: (id: string, schema?: string) =>
        api.get(`/connectors/${id}/tables`, { params: { schema_name: schema } }),
    getColumns: (id: string, table: string, schema?: string) =>
        api.get(`/connectors/${id}/columns`, { params: { table, schema_name: schema } }),
    preview: (id: string, table: string, schema?: string, limit: number = 10) =>
        api.get(`/connectors/${id}/preview`, { params: { table, schema_name: schema, limit } }),
};

// Runs API
export const runsAPI = {
    list: (params?: any) => api.get('/runs', { params }),
    get: (id: string) => api.get(`/runs/${id}`),
    getDetails: (id: string) => api.get(`/runs/${id}/details`),
    getLogs: (id: string) => api.get(`/runs/${id}/logs`),
    getArtifacts: (id: string) => api.get(`/runs/${id}/artifacts`),
    rerun: (id: string) => api.post(`/runs/${id}/rerun`),
    downloadArtifact: async (runId: string, artifactId: string, filename: string) => {
        const response = await api.get(`/runs/${runId}/artifacts/${artifactId}/download`, {
            responseType: 'blob'
        });
        // Create download link and trigger download
        const blob = new Blob([response.data], { type: response.headers['content-type'] });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },
};

// Report Destinations API (for auto-delivery linking)
export const reportDestinationsAPI = {
    list: (reportId: string) => api.get(`/reports/${reportId}/destinations`),
    link: (reportId: string, destinationId: string) =>
        api.post(`/reports/${reportId}/destinations`, { destination_id: destinationId }),
    unlink: (reportId: string, destinationId: string) =>
        api.delete(`/reports/${reportId}/destinations/${destinationId}`),
};

// Mappings API
export const mappingsAPI = {
    listSets: () => api.get('/mappings'),
    getSet: (id: string) => api.get(`/mappings/${id}`),
    createSet: (data: any) => api.post('/mappings', data),
    updateSet: (id: string, data: any) => api.put(`/mappings/${id}`, data),
    deleteSet: (id: string) => api.delete(`/mappings/${id}`),
    listEntries: (setId: string, params?: { search?: string; sort_by?: string; sort_order?: string }) =>
        api.get(`/mappings/${setId}/entries`, { params }),
    createEntry: (setId: string, data: any) => api.post(`/mappings/${setId}/entries`, data),
    updateEntry: (setId: string, entryId: string, data: any) =>
        api.put(`/mappings/${setId}/entries/${entryId}`, data),
    deleteEntry: (setId: string, entryId: string) =>
        api.delete(`/mappings/${setId}/entries/${entryId}`),
    importCSV: (setId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(`/mappings/${setId}/import`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    exportCSV: (setId: string) => api.get(`/mappings/${setId}/export`),
};

// Validations API
export const validationsAPI = {
    list: () => api.get('/validations'),
    get: (id: string) => api.get(`/validations/${id}`),
    create: (data: any) => api.post('/validations', data),
    update: (id: string, data: any) => api.put(`/validations/${id}`, data),
    delete: (id: string) => api.delete(`/validations/${id}`),
};

// Schedules API
export const schedulesAPI = {
    list: () => api.get('/schedules'),
    get: (id: string) => api.get(`/schedules/${id}`),
    create: (data: any) => api.post('/schedules', data),
    update: (id: string, data: any) => api.put(`/schedules/${id}`, data),
    toggle: (id: string) => api.put(`/schedules/${id}/toggle`),
    delete: (id: string) => api.delete(`/schedules/${id}`),
};

// Destinations API
export const destinationsAPI = {
    list: () => api.get('/destinations'),
    get: (id: string) => api.get(`/destinations/${id}`),
    create: (data: any) => api.post('/destinations', data),
    update: (id: string, data: any) => api.put(`/destinations/${id}`, data),
    delete: (id: string) => api.delete(`/destinations/${id}`),
    test: (data: any) => api.post('/destinations/test', data),
    testExisting: (id: string) => api.post(`/destinations/${id}/test`),
    getDeliveries: (id: string, skip?: number, limit?: number) =>
        api.get(`/delivery/destinations/${id}/deliveries`, { params: { skip, limit } }),
};

// Delivery API
export const deliveryAPI = {
    trigger: (artifactId: string, destinationId: string) =>
        api.post(`/delivery/artifacts/${artifactId}/deliver`, { destination_id: destinationId }),
    getArtifactDeliveries: (artifactId: string) =>
        api.get(`/delivery/artifacts/${artifactId}/deliveries`),
};

// Admin API
export const adminAPI = {
    listUsers: () => api.get('/admin/users'),
    getUser: (id: string) => api.get(`/admin/users/${id}`),
    getCurrentUser: () => api.get('/admin/users/me'),
    createUser: (data: any) => api.post('/admin/users', data),
    updateUser: (id: string, data: any) => api.put(`/admin/users/${id}`, data),
    deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
    listRoles: () => api.get('/admin/roles'),
    createRole: (data: any) => api.post('/admin/roles', data),
    updateRole: (id: string, data: any) => api.put(`/admin/roles/${id}`, data),
    deleteRole: (id: string) => api.delete(`/admin/roles/${id}`),
    getAuditLogs: (params?: any) => api.get('/admin/audit', { params }),
    getAuditStats: () => api.get('/admin/audit/stats'),
    getSystemHealth: () => api.get('/admin/health'),
    // Settings
    getSettings: () => api.get('/admin/settings'),
    updateSettings: (data: { session_timeout_minutes?: number }) => api.put('/admin/settings', data),
};

// Schemas API (XSD Management)
export const schemasAPI = {
    list: () => api.get('/schemas'),
    get: (id: string) => api.get(`/schemas/${id}`),
    create: (data: { name: string; description?: string; version?: string; xsd_content: string }) =>
        api.post('/schemas', data),
    upload: (file: File, name: string, description?: string, version?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        if (description) formData.append('description', description);
        if (version) formData.append('version', version);
        return api.post('/schemas/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    delete: (id: string) => api.delete(`/schemas/${id}`),
    getElements: (id: string, flat: boolean = true) =>
        api.get(`/schemas/${id}/elements`, { params: { flat } }),
    validate: (id: string, xml_content: string) =>
        api.post(`/schemas/${id}/validate`, { xml_content }),
    parsePreview: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/schemas/parse-preview', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};

// Dashboard API
export const dashboardAPI = {
    getDailySummary: (businessDate?: string) =>
        api.get('/dashboard/daily-summary', { params: { business_date: businessDate } }),
    getPreviousBusinessDate: (referenceDate?: string) =>
        api.get('/dashboard/previous-business-date', { params: { reference_date: referenceDate } }),
};

// XBRL Taxonomy API
export const xbrlAPI = {
    upload: (file: File, name?: string, description?: string, version?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/xbrl/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            params: { name, description, version }
        });
    },
    list: (isActive?: boolean) =>
        api.get('/xbrl', { params: { is_active: isActive } }),
    get: (id: string) => api.get(`/xbrl/${id}`),
    delete: (id: string) => api.delete(`/xbrl/${id}`),
    getConcepts: (id: string, search?: string, abstractOnly?: boolean) =>
        api.get(`/xbrl/${id}/concepts`, { params: { search, abstract_only: abstractOnly } }),
    getDimensions: (id: string) => api.get(`/xbrl/${id}/dimensions`),
    getPresentation: (id: string, role?: string) =>
        api.get(`/xbrl/${id}/presentation`, { params: { role } }),
    getCalculation: (id: string) => api.get(`/xbrl/${id}/calculation`),
    getDefinition: (id: string) => api.get(`/xbrl/${id}/definition`),
};

// Streaming Topics API (Kafka/AMQ Streams)
export const streamingAPI = {
    // Topics CRUD
    listTopics: () => api.get('/streaming/topics'),
    getTopic: (id: string) => api.get(`/streaming/topics/${id}`),
    createTopic: (data: any) => api.post('/streaming/topics', data),
    updateTopic: (id: string, data: any) => api.put(`/streaming/topics/${id}`, data),
    deleteTopic: (id: string) => api.delete(`/streaming/topics/${id}`),

    // Connection testing
    testConnection: (id: string) => api.post(`/streaming/topics/${id}/test`),

    // Buffer statistics
    getBufferStats: () => api.get('/streaming/buffer/stats'),
};

// Data Lineage API (v2 Enterprise)
export const lineageAPI = {
    // Get full lineage graph for current tenant
    getGraph: () => api.get('/lineage/graph'),

    // Get upstream/downstream lineage for a specific report
    getReportLineage: (reportId: string) => api.get(`/lineage/report/${reportId}`),

    // Trigger full lineage rebuild for tenant
    refresh: () => api.post('/lineage/refresh'),

    // Rebuild lineage for a specific report
    rebuildReport: (reportId: string) => api.post(`/lineage/report/${reportId}/rebuild`),
};

// External API Service (Regulatory Data Sync)
export const externalAPIService = {
    // Connection
    getConnectionStatus: () => api.get('/external-api/connection'),
    connect: (apiKey: string) => api.post('/external-api/connect', { api_key: apiKey }),
    disconnect: () => api.post('/external-api/disconnect'),

    // Configurations (legacy)
    listConfigs: () => api.get('/external-api/configs'),
    getConfig: (id: string) => api.get(`/external-api/configs/${id}`),
    createConfig: (data: any) => api.post('/external-api/configs', data),
    updateConfig: (id: string, data: any) => api.put(`/external-api/configs/${id}`, data),
    deleteConfig: (id: string) => api.delete(`/external-api/configs/${id}`),
    testConnection: (id: string) => api.post(`/external-api/configs/${id}/test`),

    // Sync operations
    triggerSync: (id: string, mode: string = 'differential') =>
        api.post(`/external-api/configs/${id}/sync`, { mode }),
    getSyncHistory: (id: string, limit: number = 20, offset: number = 0) =>
        api.get(`/external-api/configs/${id}/sync-history`, { params: { limit, offset } }),
    getSyncStatus: () => api.get('/external-api/sync-status'),

    // Conflicts
    listConflicts: () => api.get('/external-api/conflicts'),
    resolveConflict: (entityType: string, entityId: string, resolution: string) =>
        api.post(`/external-api/conflicts/${entityType}/${entityId}/resolve`, { resolution }),

    // Import
    importJSON: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/external-api/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};

// Templates API (Pre-built regulatory templates)
export const templatesAPI = {
    list: (regulation?: string, category?: string) =>
        api.get('/templates', { params: { regulation, category } }),
    get: (id: string) => api.get(`/templates/${id}`),
    import: (id: string, data: {
        name?: string;
        description?: string;
        connector_id?: string;
        source_table?: string;
    }) => api.post(`/templates/${id}/import`, data),
};

