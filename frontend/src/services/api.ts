import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
    baseURL: `${API_URL}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
        const { state } = JSON.parse(authStorage);
        if (state?.token) {
            config.headers.Authorization = `Bearer ${state.token}`;
        }
    }
    return config;
});

// Handle 401// Response interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Session expired or unauthorized
            localStorage.removeItem('auth-storage');

            // Only redirect if not already on login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

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
