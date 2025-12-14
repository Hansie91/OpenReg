import { useQuery } from 'react-query';
import { dashboardAPI, runsAPI, reportsAPI, connectorsAPI } from '../services/api';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

// Icons
const Icons = {
    Reports: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
    ),
    Success: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    Failed: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    Database: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
    ),
    ArrowRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
    ),
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
    ),
    Calendar: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
    ),
    Clock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    ChartBar: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
    ),
};

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

// Helper to get previous business date (T-1)
const getPreviousBusinessDate = (): Date => {
    const today = new Date();
    let prevDate = new Date(today);
    prevDate.setDate(prevDate.getDate() - 1);

    // Skip weekends
    while (prevDate.getDay() === 0 || prevDate.getDay() === 6) {
        prevDate.setDate(prevDate.getDate() - 1);
    }

    return prevDate;
};

// User preference keys
const PREF_DEFAULT_DATE_VIEW = 'dashboard_default_date_view';

export default function Dashboard() {
    // Get default preference from localStorage
    const getDefaultDate = (): string => {
        const pref = localStorage.getItem(PREF_DEFAULT_DATE_VIEW);
        if (pref === 'today') {
            return formatDate(new Date());
        }
        // Default to previous business date (T-1)
        return formatDate(getPreviousBusinessDate());
    };

    const [selectedDate, setSelectedDate] = useState<string>(getDefaultDate());
    const [defaultDateView, setDefaultDateView] = useState<'previous' | 'today'>(
        localStorage.getItem(PREF_DEFAULT_DATE_VIEW) === 'today' ? 'today' : 'previous'
    );

    // Fetch daily summary
    const { data: summaryResponse, isLoading: summaryLoading, refetch: refetchSummary } = useQuery(
        ['daily-summary', selectedDate],
        () => dashboardAPI.getDailySummary(selectedDate).then((res) => res.data),
        { keepPreviousData: true }
    );

    // Keep existing queries for stats cards
    const { data: runsResponse, isLoading: runsLoading } = useQuery('recent-runs', () =>
        runsAPI.list().then((res) => res.data)
    );

    const { data: reportsResponse } = useQuery('reports-count', () =>
        reportsAPI.list().then((res) => res.data)
    );

    const { data: connectorsResponse } = useQuery('connectors-count', () =>
        connectorsAPI.list().then((res) => res.data)
    );

    // Extract actual data arrays from response objects
    const runs = runsResponse?.data || [];
    const reports = reportsResponse?.data || reportsResponse || [];
    const connectors = connectorsResponse?.data || connectorsResponse || [];

    const stats = [
        {
            name: 'Total Reports',
            value: reports?.length || 0,
            icon: Icons.Reports,
            color: 'bg-indigo-500',
            bgColor: 'bg-indigo-50',
            textColor: 'text-indigo-600',
            link: '/reports',
        },
        {
            name: 'Successful Runs',
            value: runs?.filter((r: any) => r.status === 'success').length || 0,
            icon: Icons.Success,
            color: 'bg-emerald-500',
            bgColor: 'bg-emerald-50',
            textColor: 'text-emerald-600',
            link: '/runs',
        },
        {
            name: 'Failed Runs',
            value: runs?.filter((r: any) => r.status === 'failed').length || 0,
            icon: Icons.Failed,
            color: 'bg-red-500',
            bgColor: 'bg-red-50',
            textColor: 'text-red-600',
            link: '/runs',
        },
        {
            name: 'Connectors',
            value: connectors?.length || 0,
            icon: Icons.Database,
            color: 'bg-purple-500',
            bgColor: 'bg-purple-50',
            textColor: 'text-purple-600',
            link: '/connectors',
        },
    ];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'success':
                return <span className="badge badge-success">Success</span>;
            case 'failed':
                return <span className="badge badge-error">Failed</span>;
            case 'running':
                return <span className="badge badge-info">Running</span>;
            case 'pending':
                return <span className="badge badge-gray">Pending</span>;
            case 'partial':
                return <span className="badge badge-warning">Partial</span>;
            case 'not_run':
                return <span className="badge badge-gray">Not Run</span>;
            default:
                return <span className="badge badge-gray">{status}</span>;
        }
    };

    // Handle date change
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedDate(e.target.value);
    };

    // Quick date buttons
    const setToday = () => setSelectedDate(formatDate(new Date()));
    const setYesterday = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        setSelectedDate(formatDate(yesterday));
    };
    const setTMinus1 = () => setSelectedDate(formatDate(getPreviousBusinessDate()));

    // Handle preference change
    const handlePreferenceChange = (pref: 'previous' | 'today') => {
        setDefaultDateView(pref);
        localStorage.setItem(PREF_DEFAULT_DATE_VIEW, pref);
    };

    // Handle artifact download
    const handleDownload = async (runId: string, artifactId: string, filename: string) => {
        try {
            await runsAPI.downloadArtifact(runId, artifactId, filename);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    // Extract data from summary response
    const scheduledReports = summaryResponse?.scheduled_reports || [];
    const submissionStats = summaryResponse?.submission_stats || {
        total_records: 0,
        records_submitted: 0,
        records_accepted: 0,
        records_rejected: 0,
        pre_validation_failed: 0,
        file_rejections: 0,
        record_rejections: 0,
        file_submissions: []
    };
    const pendingSchedules = summaryResponse?.pending_schedules || [];
    const summary = summaryResponse?.summary || { total_scheduled: 0, executed: 0, success: 0, failed: 0, running: 0, pending: 0 };

    return (
        <div className="animate-fade-in">
            {/* Page Header with Date Picker */}
            <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-description">
                        Regulatory reporting activity for {new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </p>
                </div>

                {/* Date Picker Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Icons.Calendar />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={handleDateChange}
                            className="input input-bordered input-sm"
                        />
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={setTMinus1}
                            className={`btn btn-xs ${selectedDate === formatDate(getPreviousBusinessDate()) ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            T-1
                        </button>
                        <button
                            onClick={setYesterday}
                            className={`btn btn-xs ${selectedDate === formatDate(new Date(Date.now() - 86400000)) ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            Yesterday
                        </button>
                        <button
                            onClick={setToday}
                            className={`btn btn-xs ${selectedDate === formatDate(new Date()) ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            Today
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Link
                            key={stat.name}
                            to={stat.link}
                            className="card p-6 group hover:shadow-lg transition-all cursor-pointer"
                        >
                            <div className="flex items-center justify-between">
                                <div className={`stat-icon ${stat.bgColor}`}>
                                    <div className={stat.textColor}>
                                        <Icon />
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Icons.ArrowRight />
                                </div>
                            </div>
                            <div className="mt-4">
                                <p className="stat-value">{stat.value}</p>
                                <p className="stat-label">{stat.name}</p>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Scheduled Reports Table */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Icons.Reports />
                        Scheduled Reports
                        {summary.executed > 0 && (
                            <span className="text-sm font-normal text-gray-500">
                                ({summary.success} success, {summary.failed} failed)
                            </span>
                        )}
                    </h2>
                    <Link to="/schedules" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                        Manage Schedules
                        <Icons.ArrowRight />
                    </Link>
                </div>

                {summaryLoading ? (
                    <div className="card p-8 text-center">
                        <div className="spinner mx-auto text-indigo-600"></div>
                        <p className="mt-3 text-sm text-gray-500">Loading report data...</p>
                    </div>
                ) : scheduledReports.length > 0 ? (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Report Name</th>
                                    <th>Schedule</th>
                                    <th>Status</th>
                                    <th>Triggered By</th>
                                    <th>Created</th>
                                    <th>Duration</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scheduledReports.map((report: any) => (
                                    <tr key={report.schedule_id || report.report_id}>
                                        <td className="font-medium">{report.report_name}</td>
                                        <td>
                                            <div className="text-sm">
                                                <div className="font-medium">{report.schedule_name}</div>
                                                {report.cron_expression && (
                                                    <div className="text-gray-500 font-mono text-xs">{report.cron_expression}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td>{getStatusBadge(report.status)}</td>
                                        <td className="capitalize">{report.triggered_by || '-'}</td>
                                        <td>
                                            {report.created_at
                                                ? new Date(report.created_at).toLocaleTimeString()
                                                : '-'
                                            }
                                        </td>
                                        <td>
                                            {report.duration_seconds
                                                ? `${Math.round(report.duration_seconds)}s`
                                                : '-'
                                            }
                                        </td>
                                        <td>
                                            {report.artifact_id && report.job_run_id ? (
                                                <button
                                                    onClick={() => handleDownload(
                                                        report.job_run_id,
                                                        report.artifact_id,
                                                        report.filename || 'report.xml'
                                                    )}
                                                    className="btn btn-xs btn-ghost text-indigo-600 hover:bg-indigo-50"
                                                    title="Download Report"
                                                >
                                                    <Icons.Download />
                                                </button>
                                            ) : report.job_run_id ? (
                                                <Link
                                                    to={`/runs`}
                                                    className="btn btn-xs btn-ghost text-gray-500"
                                                    title="View Run"
                                                >
                                                    View
                                                </Link>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <Icons.Reports />
                        <h3 className="empty-state-title">No scheduled reports for this date</h3>
                        <p className="empty-state-description">
                            No reports were scheduled to run on {selectedDate}
                        </p>
                        <Link to="/schedules" className="btn btn-primary mt-4">
                            Create Schedule
                        </Link>
                    </div>
                )}
            </div>

            {/* Pending Schedules (if any) */}
            {pendingSchedules.length > 0 && (
                <div className="mt-6">
                    <div className="card p-4 bg-yellow-50 border-yellow-200">
                        <h3 className="text-sm font-semibold text-yellow-800 flex items-center gap-2 mb-3">
                            <Icons.Clock />
                            Pending Today ({pendingSchedules.length})
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {pendingSchedules.map((schedule: any) => (
                                <div key={schedule.schedule_id} className="bg-white rounded-lg px-3 py-2 border border-yellow-200">
                                    <div className="text-sm font-medium text-gray-900">{schedule.report_name}</div>
                                    <div className="text-xs text-gray-500">
                                        Next run: {schedule.next_run_at
                                            ? new Date(schedule.next_run_at).toLocaleTimeString()
                                            : 'TBD'
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Submission Statistics */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Statistics Card */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                        <Icons.ChartBar />
                        Submission Statistics
                    </h2>

                    {summaryLoading ? (
                        <div className="text-center py-4">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Records Sent */}
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Records Sent</span>
                                <span className="font-semibold">
                                    {submissionStats.records_submitted.toLocaleString()} / {submissionStats.total_records.toLocaleString()}
                                    {submissionStats.total_records > 0 && (
                                        <span className="text-gray-500 text-sm ml-2">
                                            ({Math.round((submissionStats.records_submitted / submissionStats.total_records) * 100)}%)
                                        </span>
                                    )}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            {submissionStats.total_records > 0 && (
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className="bg-indigo-600 h-2.5 rounded-full"
                                        style={{
                                            width: `${(submissionStats.records_submitted / submissionStats.total_records) * 100}%`
                                        }}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="p-3 rounded-lg bg-emerald-50">
                                    <div className="text-2xl font-bold text-emerald-600">
                                        {submissionStats.records_accepted.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-emerald-700">Accepted</div>
                                    {submissionStats.records_submitted > 0 && (
                                        <div className="text-xs text-emerald-600">
                                            {Math.round((submissionStats.records_accepted / submissionStats.records_submitted) * 100)}%
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 rounded-lg bg-red-50">
                                    <div className="text-2xl font-bold text-red-600">
                                        {submissionStats.records_rejected.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-red-700">Rejected</div>
                                    {submissionStats.records_submitted > 0 && (
                                        <div className="text-xs text-red-600">
                                            {Math.round((submissionStats.records_rejected / submissionStats.records_submitted) * 100)}%
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Breakdown */}
                            <div className="border-t pt-4 mt-4 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">File Rejections</span>
                                    <span className={submissionStats.file_rejections > 0 ? "text-red-600 font-medium" : "text-gray-600"}>
                                        {submissionStats.file_rejections}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Record Rejections</span>
                                    <span className={submissionStats.record_rejections > 0 ? "text-red-600 font-medium" : "text-gray-600"}>
                                        {submissionStats.record_rejections}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Pre-Validation Failures</span>
                                    <span className={submissionStats.pre_validation_failed > 0 ? "text-amber-600 font-medium" : "text-gray-600"}>
                                        {submissionStats.pre_validation_failed}
                                    </span>
                                </div>
                            </div>

                            {/* Link to exceptions if there are rejections */}
                            {(submissionStats.records_rejected > 0 || submissionStats.pre_validation_failed > 0) && (
                                <Link
                                    to="/exceptions"
                                    className="btn btn-sm btn-outline btn-error w-full mt-4"
                                >
                                    View Exception Queue
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                {/* Default View Preference + Quick Start */}
                <div className="space-y-6">
                    {/* Preference Card */}
                    <div className="card p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Dashboard Preferences</h3>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">Default view:</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePreferenceChange('previous')}
                                    className={`btn btn-xs ${defaultDateView === 'previous' ? 'btn-primary' : 'btn-ghost'}`}
                                >
                                    Previous Business Date (T-1)
                                </button>
                                <button
                                    onClick={() => handlePreferenceChange('today')}
                                    className={`btn btn-xs ${defaultDateView === 'today' ? 'btn-primary' : 'btn-ghost'}`}
                                >
                                    Today
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Start Guide */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start Guide</h2>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">1</div>
                                <div>
                                    <h3 className="font-medium text-gray-900 text-sm">Add a Connector</h3>
                                    <Link to="/connectors" className="text-xs text-indigo-600 font-medium hover:text-indigo-700">
                                        Add Connector →
                                    </Link>
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">2</div>
                                <div>
                                    <h3 className="font-medium text-gray-900 text-sm">Create a Report</h3>
                                    <Link to="/reports" className="text-xs text-emerald-600 font-medium hover:text-emerald-700">
                                        Create Report →
                                    </Link>
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">3</div>
                                <div>
                                    <h3 className="font-medium text-gray-900 text-sm">Execute & Deliver</h3>
                                    <Link to="/destinations" className="text-xs text-purple-600 font-medium hover:text-purple-700">
                                        Set Destinations →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
