import { useQuery } from 'react-query';
import { dashboardAPI, runsAPI, reportsAPI, connectorsAPI } from '../services/api';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { LoadingState } from '../components/LoadingState';

// Icons - smaller
const Icons = {
    Reports: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
    ),
    Success: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    Failed: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    Database: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
    ),
    ArrowRight: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
    ),
    Download: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
    ),
    Calendar: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
    ),
    Clock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    ChartBar: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
    ),
};

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

// Helper to parse cron expression and return human-readable schedule
const formatCronSchedule = (cronExpr: string | null | undefined): { time: string; frequency: string } => {
    if (!cronExpr) return { time: '-', frequency: '' };

    // Handle calendar-based descriptions (from embedded schedules)
    if (cronExpr.startsWith('Calendar:')) {
        return { time: cronExpr.replace('Calendar: ', ''), frequency: '' };
    }

    // Parse standard cron: minute hour day-of-month month day-of-week
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 5) return { time: cronExpr, frequency: '' };

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Format time (HH:MM)
    let timeStr = '-';
    if (hour !== '*' && minute !== '*') {
        const h = hour.padStart(2, '0');
        const m = minute.padStart(2, '0');
        timeStr = `${h}:${m}`;
    } else if (hour !== '*') {
        timeStr = `${hour.padStart(2, '0')}:00`;
    }

    // Determine frequency
    let freqStr = '';
    if (dayOfMonth === '*' && month === '*') {
        if (dayOfWeek === '*') {
            freqStr = 'Daily';
        } else if (dayOfWeek === '1-5') {
            freqStr = 'Weekdays';
        } else if (dayOfWeek === '1') {
            freqStr = 'Weekly (Mon)';
        } else if (dayOfWeek === '0' || dayOfWeek === '7') {
            freqStr = 'Weekly (Sun)';
        } else {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayNum = parseInt(dayOfWeek);
            if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
                freqStr = `Weekly (${days[dayNum]})`;
            }
        }
    } else if (dayOfMonth !== '*' && month === '*') {
        freqStr = `Monthly (${dayOfMonth}${getOrdinalSuffix(parseInt(dayOfMonth))})`;
    } else if (month !== '*') {
        freqStr = 'Yearly';
    }

    return { time: timeStr, frequency: freqStr };
};

// Helper for ordinal suffix
const getOrdinalSuffix = (n: number): string => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
};

// Helper to format time until next run (like Schedules page)
const formatNextRun = (dateStr: string | null): { text: string; isUrgent: boolean; isOverdue: boolean } => {
    if (!dateStr) return { text: 'Not scheduled', isUrgent: false, isOverdue: false };
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (diff < 0) return { text: 'Overdue', isUrgent: true, isOverdue: true };
    if (hours < 1) return { text: `In ${minutes}m`, isUrgent: true, isOverdue: false };
    if (hours < 24) return { text: `In ${hours}h ${minutes}m`, isUrgent: hours < 2, isOverdue: false };
    return {
        text: date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUrgent: false,
        isOverdue: false
    };
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
    const { data: summaryResponse, isLoading: summaryLoading } = useQuery(
        ['daily-summary', selectedDate],
        () => dashboardAPI.getDailySummary(selectedDate).then((res) => res.data),
        { keepPreviousData: true }
    );

    // Keep existing queries for stats cards
    const { data: runsResponse } = useQuery('recent-runs', () =>
        runsAPI.list().then((res) => res.data)
    );

    const { data: reportsResponse } = useQuery('reports-count', () =>
        reportsAPI.list().then((res) => res.data)
    );

    const { data: connectorsResponse } = useQuery('connectors-count', () =>
        connectorsAPI.list().then((res) => res.data)
    );

    // Extract actual data arrays from response objects
    const runs = runsResponse?.runs || [];
    const reports = reportsResponse?.data || reportsResponse || [];
    const connectors = connectorsResponse?.data || connectorsResponse || [];

    const stats = [
        {
            name: 'Reports',
            value: reports?.length || 0,
            icon: Icons.Reports,
            link: '/reports',
        },
        {
            name: 'Successful',
            value: runs?.filter((r: any) => r.status === 'success').length || 0,
            icon: Icons.Success,
            link: '/runs',
        },
        {
            name: 'Failed',
            value: runs?.filter((r: any) => r.status === 'failed').length || 0,
            icon: Icons.Failed,
            link: '/runs',
        },
        {
            name: 'Connectors',
            value: connectors?.length || 0,
            icon: Icons.Database,
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
    const summary = summaryResponse?.summary || { total_scheduled: 0, executed: 0, success: 0, failed: 0, running: 0, pending: 0 };

    return (
        <div className="animate-fade-in">
            {/* Page Header with Date Picker */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-base font-semibold text-gray-900">Dashboard</h1>
                    <p className="text-xs text-gray-500">
                        {new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })}
                    </p>
                </div>

                {/* Date Picker Controls */}
                <div className="flex items-center gap-2">
                    <Icons.Calendar />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={handleDateChange}
                        className="input input-sm w-32"
                    />
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

            {/* Compact Stats Row */}
            <div className="grid grid-cols-4 gap-3 mb-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Link
                            key={stat.name}
                            to={stat.link}
                            className="card p-3 hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="text-gray-400">
                                    <Icon />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
                                    <p className="text-xs text-gray-500">{stat.name}</p>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Scheduled Reports Table */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        Scheduled Reports
                        {summary.executed > 0 && (
                            <span className="text-xs font-normal text-gray-500">
                                ({summary.success} success, {summary.failed} failed)
                            </span>
                        )}
                    </h2>
                    <Link to="/reports" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        Manage Reports
                        <Icons.ArrowRight />
                    </Link>
                </div>

                {summaryLoading ? (
                    <LoadingState message="Loading scheduled reports..." size="sm" />
                ) : scheduledReports.length > 0 ? (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Report</th>
                                    <th>Scheduled</th>
                                    <th>Status</th>
                                    <th>Triggered</th>
                                    <th>Run Time</th>
                                    <th>Duration</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {scheduledReports.map((report: any) => {
                                    const nextRun = report.next_run_at ? formatNextRun(report.next_run_at) : null;
                                    return (
                                        <tr key={report.schedule_id || report.report_id}>
                                            <td className="font-medium">{report.report_name}</td>
                                            <td>
                                                {(() => {
                                                    const { time, frequency } = formatCronSchedule(report.cron_expression);
                                                    return (
                                                        <div className="text-xs">
                                                            <div className="font-medium">{time}</div>
                                                            {frequency && <div className="text-gray-400">{frequency}</div>}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td>
                                                {report.status === 'not_run' && nextRun ? (
                                                    <span className={`badge ${
                                                        nextRun.isOverdue
                                                            ? 'badge-error'
                                                            : nextRun.isUrgent
                                                                ? 'badge-warning'
                                                                : 'badge-info'
                                                    }`}>
                                                        {nextRun.text}
                                                    </span>
                                                ) : (
                                                    getStatusBadge(report.status)
                                                )}
                                            </td>
                                            <td className="capitalize text-gray-500">{report.triggered_by || '-'}</td>
                                            <td className="text-gray-500">
                                                {report.created_at
                                                    ? new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : '-'
                                                }
                                            </td>
                                            <td className="text-gray-500">
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
                                                        className="btn btn-xs btn-ghost text-blue-600"
                                                        title="Download"
                                                    >
                                                        <Icons.Download />
                                                    </button>
                                                ) : report.job_run_id ? (
                                                    <Link
                                                        to={`/runs`}
                                                        className="btn btn-xs btn-ghost text-gray-500"
                                                    >
                                                        View
                                                    </Link>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icons.Reports /></div>
                        <h3 className="empty-state-title">No scheduled reports</h3>
                        <p className="empty-state-description">No reports scheduled for {selectedDate}</p>
                        <Link to="/reports" className="btn btn-primary btn-sm mt-3">Manage Reports</Link>
                    </div>
                )}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-4">
                {/* Submission Statistics */}
                <div className="card p-4">
                    <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
                        <Icons.ChartBar />
                        Submission Stats
                    </h2>

                    {summaryLoading ? (
                        <LoadingState message="Loading statistics..." size="sm" />
                    ) : (
                        <div className="space-y-3">
                            {/* Records Sent */}
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">Records Sent</span>
                                <span className="font-medium">
                                    {submissionStats.records_submitted.toLocaleString()} / {submissionStats.total_records.toLocaleString()}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            {submissionStats.total_records > 0 && (
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="bg-blue-600 h-1.5 rounded-full"
                                        style={{
                                            width: `${(submissionStats.records_submitted / submissionStats.total_records) * 100}%`
                                        }}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-2 rounded bg-emerald-50 text-center">
                                    <div className="text-lg font-bold text-emerald-600">
                                        {submissionStats.records_accepted.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-emerald-700">Accepted</div>
                                </div>

                                <div className="p-2 rounded bg-red-50 text-center">
                                    <div className="text-lg font-bold text-red-600">
                                        {submissionStats.records_rejected.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-red-700">Rejected</div>
                                </div>
                            </div>

                            {/* Breakdown */}
                            <div className="border-t pt-2 space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">File Rejections</span>
                                    <span className={submissionStats.file_rejections > 0 ? "text-red-600 font-medium" : "text-gray-600"}>
                                        {submissionStats.file_rejections}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Record Rejections</span>
                                    <span className={submissionStats.record_rejections > 0 ? "text-red-600 font-medium" : "text-gray-600"}>
                                        {submissionStats.record_rejections}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Pre-Validation Failures</span>
                                    <span className={submissionStats.pre_validation_failed > 0 ? "text-amber-600 font-medium" : "text-gray-600"}>
                                        {submissionStats.pre_validation_failed}
                                    </span>
                                </div>
                            </div>

                            {/* Link to exceptions */}
                            {(submissionStats.records_rejected > 0 || submissionStats.pre_validation_failed > 0) && (
                                <Link to="/exceptions" className="btn btn-sm btn-outline btn-error w-full">
                                    View Exceptions
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    {/* Preference Card */}
                    <div className="card p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Default view:</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handlePreferenceChange('previous')}
                                    className={`btn btn-xs ${defaultDateView === 'previous' ? 'btn-primary' : 'btn-ghost'}`}
                                >
                                    T-1
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

                    {/* Quick Start */}
                    <div className="card p-4">
                        <h2 className="text-sm font-medium text-gray-900 mb-3">Quick Start</h2>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 p-2 rounded bg-gray-50">
                                <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">1</span>
                                <div className="flex-1 text-xs">
                                    <span className="text-gray-700">Connect API</span>
                                </div>
                                <Link to="/external-api" className="text-xs text-blue-600 hover:text-blue-700">Connect →</Link>
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded bg-gray-50">
                                <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">2</span>
                                <div className="flex-1 text-xs">
                                    <span className="text-gray-700">Add a connector</span>
                                </div>
                                <Link to="/connectors" className="text-xs text-blue-600 hover:text-blue-700">Add →</Link>
                            </div>
                            <div className="flex items-center gap-3 p-2 rounded bg-gray-50">
                                <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">3</span>
                                <div className="flex-1 text-xs">
                                    <span className="text-gray-700">Set destination & schedule</span>
                                </div>
                                <Link to="/destinations" className="text-xs text-blue-600 hover:text-blue-700">Configure →</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
