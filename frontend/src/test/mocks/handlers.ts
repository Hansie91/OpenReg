import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:8000/api/v1';

// Mock user data
const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    full_name: 'Admin User',
    tenant_id: 'tenant-123',
    is_superuser: true,
    is_active: true,
    created_at: new Date().toISOString(),
};

// Mock tokens
const mockTokenResponse = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: mockUser,
};

export const handlers = [
    // Auth endpoints
    http.post(`${API_URL}/auth/login`, async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string };

        if (body.email === 'admin@example.com' && body.password === 'admin123') {
            return HttpResponse.json(mockTokenResponse);
        }

        return HttpResponse.json(
            { detail: 'Incorrect email or password' },
            { status: 401 }
        );
    }),

    http.post(`${API_URL}/auth/refresh`, async ({ request }) => {
        const body = (await request.json()) as { refresh_token: string };

        if (body.refresh_token) {
            return HttpResponse.json({
                ...mockTokenResponse,
                access_token: 'new-mock-access-token',
                refresh_token: 'new-mock-refresh-token',
            });
        }

        return HttpResponse.json(
            { detail: 'Invalid or expired refresh token' },
            { status: 401 }
        );
    }),

    http.get(`${API_URL}/auth/me`, () => {
        return HttpResponse.json(mockUser);
    }),

    http.post(`${API_URL}/auth/logout`, () => {
        return HttpResponse.json({ message: 'Successfully logged out' });
    }),

    // Dashboard endpoints
    http.get(`${API_URL}/dashboard/daily-summary`, ({ request }) => {
        const url = new URL(request.url);
        const businessDate = url.searchParams.get('business_date');

        return HttpResponse.json({
            scheduled_reports: [
                {
                    schedule_id: 'schedule-1',
                    report_id: 'report-1',
                    report_name: 'Daily Transaction Report',
                    schedule_name: 'Daily 6AM',
                    cron_expression: '0 6 * * *',
                    status: 'success',
                    triggered_by: 'schedule',
                    created_at: new Date().toISOString(),
                    duration_seconds: 45,
                    job_run_id: 'run-1',
                    artifact_id: 'artifact-1',
                    filename: 'report.xml',
                },
            ],
            submission_stats: {
                total_records: 1000,
                records_submitted: 950,
                records_accepted: 940,
                records_rejected: 10,
                pre_validation_failed: 50,
                file_rejections: 0,
                record_rejections: 10,
                file_submissions: [],
            },
            pending_schedules: [],
            summary: {
                total_scheduled: 5,
                executed: 4,
                success: 3,
                failed: 1,
                running: 0,
                pending: 1,
            },
        });
    }),

    // Runs endpoints
    http.get(`${API_URL}/runs`, () => {
        return HttpResponse.json({
            data: [
                {
                    id: 'run-1',
                    report_id: 'report-1',
                    report_name: 'Daily Transaction Report',
                    status: 'success',
                    triggered_by: 'manual',
                    started_at: new Date(Date.now() - 60000).toISOString(),
                    ended_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    artifact_count: 1,
                    first_artifact_id: 'artifact-1',
                    first_artifact_filename: 'report.xml',
                },
                {
                    id: 'run-2',
                    report_id: 'report-2',
                    report_name: 'Weekly Summary',
                    status: 'failed',
                    triggered_by: 'schedule',
                    started_at: new Date(Date.now() - 120000).toISOString(),
                    ended_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    error_message: 'Connection timeout',
                    artifact_count: 0,
                },
                {
                    id: 'run-3',
                    report_id: 'report-1',
                    report_name: 'Daily Transaction Report',
                    status: 'running',
                    triggered_by: 'schedule',
                    started_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    artifact_count: 0,
                },
                {
                    id: 'run-4',
                    report_id: 'report-2',
                    report_name: 'Weekly Summary',
                    status: 'pending',
                    triggered_by: 'manual',
                    created_at: new Date().toISOString(),
                    artifact_count: 0,
                },
            ],
        });
    }),

    http.get(`${API_URL}/runs/:id/details`, ({ params }) => {
        const { id } = params;
        if (id === 'run-1') {
            return HttpResponse.json({
                id: 'run-1',
                report_id: 'report-1',
                status: 'success',
                triggered_by: 'manual',
                report: { name: 'Daily Transaction Report' },
                timeline: {
                    created_at: new Date(Date.now() - 120000).toISOString(),
                    started_at: new Date(Date.now() - 60000).toISOString(),
                    ended_at: new Date().toISOString(),
                    duration_seconds: 60,
                },
                validation_results: {
                    total: 10,
                    passed: 9,
                    failed: 1,
                },
                artifacts: [
                    {
                        id: 'artifact-1',
                        filename: 'report.xml',
                        mime_type: 'application/xml',
                        size_bytes: 15360,
                    },
                ],
                error_message: null,
            });
        }
        if (id === 'run-2') {
            return HttpResponse.json({
                id: 'run-2',
                report_id: 'report-2',
                status: 'failed',
                triggered_by: 'schedule',
                report: { name: 'Weekly Summary' },
                timeline: {
                    created_at: new Date(Date.now() - 180000).toISOString(),
                    started_at: new Date(Date.now() - 120000).toISOString(),
                    ended_at: new Date().toISOString(),
                    duration_seconds: 60,
                },
                validation_results: null,
                artifacts: [],
                error_message: 'Connection timeout',
            });
        }
        return HttpResponse.json({ detail: 'Run not found' }, { status: 404 });
    }),

    http.get(`${API_URL}/runs/:id/logs`, () => {
        return HttpResponse.json({
            logs: [
                { line_number: 1, timestamp: new Date().toISOString(), level: 'info', message: 'Starting report execution' },
                { line_number: 2, timestamp: new Date().toISOString(), level: 'info', message: 'Fetching data from connector' },
                { line_number: 3, timestamp: new Date().toISOString(), level: 'info', message: 'Transformation complete' },
            ],
        });
    }),

    http.post(`${API_URL}/runs/:id/rerun`, ({ params }) => {
        return HttpResponse.json({
            run_id: 'run-new',
            status: 'pending',
            message: 'Rerun started',
        });
    }),

    // Reports endpoints
    http.get(`${API_URL}/reports`, () => {
        return HttpResponse.json([
            {
                id: 'report-1',
                name: 'Daily Transaction Report',
                description: 'Daily regulatory report',
                is_active: true,
                tenant_id: 'tenant-123',
                current_version_id: 'version-1',
                version_string: 'v1.0',
                created_at: new Date().toISOString(),
            },
            {
                id: 'report-2',
                name: 'Weekly Summary',
                description: 'Weekly summary report',
                is_active: false,
                tenant_id: 'tenant-123',
                current_version_id: null,
                created_at: new Date().toISOString(),
            },
        ]);
    }),

    http.get(`${API_URL}/reports/:id`, ({ params }) => {
        const { id } = params;
        if (id === 'report-1') {
            return HttpResponse.json({
                id: 'report-1',
                name: 'Daily Transaction Report',
                description: 'Daily regulatory report',
                is_active: true,
                tenant_id: 'tenant-123',
                current_version_id: 'version-1',
                version_string: 'v1.0',
                created_at: new Date().toISOString(),
            });
        }
        return HttpResponse.json({ detail: 'Report not found' }, { status: 404 });
    }),

    http.post(`${API_URL}/reports`, async ({ request }) => {
        const body = (await request.json()) as { name: string; description?: string };
        return HttpResponse.json({
            id: 'report-new',
            name: body.name,
            description: body.description || '',
            is_active: true,
            tenant_id: 'tenant-123',
            current_version_id: null,
            created_at: new Date().toISOString(),
        }, { status: 201 });
    }),

    http.put(`${API_URL}/reports/:id`, async ({ params, request }) => {
        const { id } = params;
        const body = (await request.json()) as { name?: string; description?: string };
        return HttpResponse.json({
            id,
            name: body.name || 'Updated Report',
            description: body.description || '',
            is_active: true,
            tenant_id: 'tenant-123',
            current_version_id: 'version-1',
            created_at: new Date().toISOString(),
        });
    }),

    http.delete(`${API_URL}/reports/:id`, ({ params }) => {
        const { id } = params;
        if (id === 'report-notfound') {
            return HttpResponse.json({ detail: 'Report not found' }, { status: 404 });
        }
        return HttpResponse.json({ message: 'Report deleted' });
    }),

    http.post(`${API_URL}/reports/:id/execute`, () => {
        return HttpResponse.json({
            run_id: 'run-new',
            status: 'pending',
            message: 'Report execution started',
        });
    }),

    http.get(`${API_URL}/reports/:id/versions`, () => {
        return HttpResponse.json([
            {
                id: 'version-1',
                report_id: 'report-1',
                major_version: 1,
                minor_version: 0,
                version_string: 'v1.0',
                python_code: 'def transform(db, mappings, params): return []',
                connector_id: 'connector-1',
                status: 'active',
                created_at: new Date().toISOString(),
            },
        ]);
    }),

    http.get(`${API_URL}/reports/:id/executions`, () => {
        return HttpResponse.json({
            data: [
                {
                    id: 'run-1',
                    report_id: 'report-1',
                    status: 'success',
                    triggered_by: 'manual',
                    created_at: new Date().toISOString(),
                },
            ],
        });
    }),

    http.get(`${API_URL}/reports/:id/stats`, () => {
        return HttpResponse.json({
            total_runs: 10,
            success_count: 8,
            failure_count: 2,
            avg_duration: 45.5,
        });
    }),

    // Connectors endpoints
    http.get(`${API_URL}/connectors`, () => {
        return HttpResponse.json([
            {
                id: 'connector-1',
                name: 'Production DB',
                type: 'postgresql',
                is_active: true,
                tenant_id: 'tenant-123',
            },
        ]);
    }),

    // Destinations endpoints
    http.get(`${API_URL}/destinations`, () => {
        return HttpResponse.json([
            {
                id: 'dest-1',
                name: 'SFTP Server',
                type: 'sftp',
                is_active: true,
                tenant_id: 'tenant-123',
            },
        ]);
    }),

    // Report destinations endpoints
    http.get(`${API_URL}/reports/:id/destinations`, () => {
        return HttpResponse.json([]);
    }),

    // Streaming endpoints
    http.get(`${API_URL}/streaming/topics`, () => {
        return HttpResponse.json([]);
    }),
];
