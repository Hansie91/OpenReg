import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { schedulesAPI, reportsAPI } from '../services/api';

// Icons
const Icons = {
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    Calendar: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
    ),
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    Clock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
    Play: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
        </svg>
    ),
    Pause: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
        </svg>
    ),
    Trash: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
    ),
};

// Demo schedules
const demoSchedules = [
    {
        id: '1',
        name: 'Daily MiFIR Report',
        report_name: 'MiFIR Transaction Report',
        schedule_type: 'cron',
        cron_expression: '0 6 * * *',
        is_active: true,
        next_run_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: '2',
        name: 'Weekly Summary',
        report_name: 'Weekly Summary Report',
        schedule_type: 'cron',
        cron_expression: '0 8 * * 1',
        is_active: true,
        next_run_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: '3',
        name: 'Monthly Compliance',
        report_name: 'Compliance Report',
        schedule_type: 'calendar',
        cron_expression: null,
        is_active: false,
        next_run_at: null,
    },
];

const cronPresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Daily at 6 AM', value: '0 6 * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Weekly on Monday', value: '0 8 * * 1' },
    { label: 'Monthly on 1st', value: '0 6 1 * *' },
];

export default function Schedules() {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteConfirmSchedule, setDeleteConfirmSchedule] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        report_id: '',
        schedule_type: 'cron',
        cron_expression: '0 6 * * *',
    });

    const { data: schedules, isLoading } = useQuery('schedules', () =>
        schedulesAPI.list().then((res) => res.data)
    );

    const { data: reports } = useQuery('reports-list', () =>
        reportsAPI.list().then((res) => res.data)
    );

    const createMutation = useMutation(
        (data: any) => schedulesAPI.create(data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('schedules');
                setShowCreateModal(false);
                setFormData({ name: '', report_id: '', schedule_type: 'cron', cron_expression: '0 6 * * *' });
            },
        }
    );

    const toggleMutation = useMutation(
        (id: string) => schedulesAPI.toggle(id),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('schedules');
            },
        }
    );

    const deleteMutation = useMutation(
        (id: string) => schedulesAPI.delete(id),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('schedules');
            },
        }
    );

    const handleSubmit = () => {
        if (!formData.name || !formData.report_id) {
            alert('Please fill in all required fields');
            return;
        }
        createMutation.mutate(formData);
    };

    const formatNextRun = (dateStr: string | null) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) return `in ${days}d`;
        if (hours > 0) return `in ${hours}h`;
        return 'soon';
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="page-title">Schedules & Triggers</h1>
                    <p className="page-description">
                        Configure automated report execution schedules
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                    <Icons.Plus />
                    <span className="ml-2">New Schedule</span>
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="card p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <Icons.Clock />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">
                            {schedules?.filter((s: any) => s.is_active).length || 0}
                        </p>
                        <p className="text-sm text-gray-500">Active Schedules</p>
                    </div>
                </div>
                <div className="card p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Icons.Calendar />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900">
                            {formatNextRun(schedules?.find((s: any) => s.is_active)?.next_run_at || null)}
                        </p>
                        <p className="text-sm text-gray-500">Next Scheduled Run</p>
                    </div>
                </div>
            </div>

            {/* Schedules Grid */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                </div>
            ) : schedules && schedules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {schedules.map((schedule: any) => (
                        <div key={schedule.id} className="card">
                            <div className="p-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-gray-900">{schedule.name}</h3>
                                    <span className={`badge ${schedule.is_active ? 'badge-success' : 'badge-gray'}`}>
                                        {schedule.is_active ? 'Active' : 'Paused'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{schedule.report_name}</p>

                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase font-medium">Schedule</p>
                                    {schedule.cron_expression ? (
                                        <p className="font-mono text-sm mt-1">{schedule.cron_expression}</p>
                                    ) : (
                                        <p className="text-sm mt-1 text-gray-600">Calendar-based</p>
                                    )}
                                </div>

                                {schedule.next_run_at && (
                                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                                        <Icons.Clock />
                                        <span>Next: {new Date(schedule.next_run_at).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                                <button onClick={() => toggleMutation.mutate(schedule.id)} className="btn btn-ghost text-sm flex-1">
                                    {schedule.is_active ? (
                                        <>
                                            <Icons.Pause />
                                            <span className="ml-1">Pause</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icons.Play />
                                            <span className="ml-1">Enable</span>
                                        </>
                                    )}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmSchedule(schedule); }} className="btn btn-ghost text-red-600 hover:bg-red-50" title="Delete schedule">
                                    <Icons.Trash />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card p-12 text-center">
                    <Icons.Calendar />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">No schedules yet</h3>
                    <p className="mt-2 text-sm text-gray-500">Get started by creating your first schedule</p>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">New Schedule</h3>
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div>
                                <label className="input-label">Schedule Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Daily MiFIR Report"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Report *</label>
                                <select
                                    className="select"
                                    value={formData.report_id}
                                    onChange={(e) => setFormData({ ...formData, report_id: e.target.value })}
                                >
                                    <option value="">Select a report...</option>
                                    {reports?.map((r: any) => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="input-label">Schedule Type</label>
                                <select
                                    className="select"
                                    value={formData.schedule_type}
                                    onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
                                >
                                    <option value="cron">Cron Expression</option>
                                    <option value="calendar">Calendar</option>
                                </select>
                            </div>
                            {formData.schedule_type === 'cron' && (
                                <div>
                                    <label className="input-label">Cron Expression</label>
                                    <div className="flex gap-2 mb-2">
                                        {cronPresets.map((preset) => (
                                            <button
                                                key={preset.value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, cron_expression: preset.value })}
                                                className={`px-3 py-1.5 text-xs rounded-lg border ${formData.cron_expression === preset.value
                                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        className="input font-mono"
                                        placeholder="0 6 * * *"
                                        value={formData.cron_expression}
                                        onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
                                    />
                                    <p className="input-helper">minute hour day month weekday</p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button onClick={handleSubmit} disabled={createMutation.isLoading} className="btn btn-primary">
                                {createMutation.isLoading ? 'Creating...' : 'Create Schedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmSchedule && (
                <div className="modal-overlay" onClick={() => setDeleteConfirmSchedule(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Confirm Delete</h3>
                            <button onClick={() => setDeleteConfirmSchedule(null)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete this schedule?</p>
                            <div className="mt-4 p-3 bg-gray-50 rounded">
                                <div className="text-sm font-medium">{deleteConfirmSchedule.name}</div>
                                <div className="text-sm text-gray-500 mt-1">
                                    Report: {deleteConfirmSchedule.report_name}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setDeleteConfirmSchedule(null)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    deleteMutation.mutate(deleteConfirmSchedule.id);
                                    setDeleteConfirmSchedule(null);
                                }}
                                className="btn btn-danger bg-red-600 hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
