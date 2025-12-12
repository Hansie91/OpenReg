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
    Edit: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
    ),
    Search: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
    ),
};

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
    const [editingSchedule, setEditingSchedule] = useState<any>(null);
    const [deleteConfirmSchedule, setDeleteConfirmSchedule] = useState<any>(null);
    const [toggleConfirmSchedule, setToggleConfirmSchedule] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        report_id: '',
        schedule_type: 'cron',
        cron_expression: '0 6 * * *',
    });
    const [editFormData, setEditFormData] = useState({
        name: '',
        cron_expression: '',
    });

    const [calendarConfig, setCalendarConfig] = useState({
        frequency: 'weekly',
        time_slots: ['09:00'],
        weekly_days: [0, 1, 2, 3, 4],  // Mon-Fri
        monthly_days: [1],
        yearly_dates: ['01-01'],
        exclusion_dates: [] as string[],
        timezone: 'UTC',
    });

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

    const updateMutation = useMutation(
        ({ id, data }: { id: string; data: any }) => schedulesAPI.update(id, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('schedules');
                setEditingSchedule(null);
            },
        }
    );

    const openEditModal = (schedule: any) => {
        setEditFormData({
            name: schedule.name || '',
            cron_expression: schedule.cron_expression || '',
        });
        setEditingSchedule(schedule);
    };

    const handleUpdate = () => {
        if (!editingSchedule) return;
        updateMutation.mutate({
            id: editingSchedule.id,
            data: {
                name: editFormData.name,
                cron_expression: editFormData.cron_expression || undefined,
            },
        });
    };

    const handleToggleConfirm = () => {
        if (!toggleConfirmSchedule) return;
        toggleMutation.mutate(toggleConfirmSchedule.id);
        setToggleConfirmSchedule(null);
    };

    // Filter schedules based on search query
    const filteredSchedules = schedules?.filter((s: any) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            s.name?.toLowerCase().includes(query) ||
            s.report_name?.toLowerCase().includes(query) ||
            s.cron_expression?.toLowerCase().includes(query) ||
            s.schedule_type?.toLowerCase().includes(query) ||
            s.calendar_config?.frequency?.toLowerCase().includes(query) ||
            (s.is_active && 'active'.includes(query)) ||
            (!s.is_active && 'paused'.includes(query)) ||
            (!s.is_active && 'inactive'.includes(query))
        );
    }) || [];

    const handleSubmit = () => {
        if (!formData.name || !formData.report_id) {
            alert('Please fill in all required fields');
            return;
        }

        const submitData: any = { ...formData };

        if (formData.schedule_type === 'calendar') {
            submitData.calendar_config = calendarConfig;
            delete submitData.cron_expression;
        }

        createMutation.mutate(submitData);
    };

    const addTimeSlot = () => {
        setCalendarConfig({
            ...calendarConfig,
            time_slots: [...calendarConfig.time_slots, '09:00'],
        });
    };

    const removeTimeSlot = (index: number) => {
        const newSlots = calendarConfig.time_slots.filter((_, i) => i !== index);
        setCalendarConfig({ ...calendarConfig, time_slots: newSlots.length > 0 ? newSlots : ['09:00'] });
    };

    const updateTimeSlot = (index: number, value: string) => {
        const newSlots = [...calendarConfig.time_slots];
        newSlots[index] = value;
        setCalendarConfig({ ...calendarConfig, time_slots: newSlots });
    };

    const toggleWeekDay = (day: number) => {
        const days = calendarConfig.weekly_days || [];
        if (days.includes(day)) {
            setCalendarConfig({ ...calendarConfig, weekly_days: days.filter(d => d !== day) });
        } else {
            setCalendarConfig({ ...calendarConfig, weekly_days: [...days, day].sort() });
        }
    };

    const toggleMonthDay = (day: number) => {
        const days = calendarConfig.monthly_days || [];
        if (days.includes(day)) {
            setCalendarConfig({ ...calendarConfig, monthly_days: days.filter(d => d !== day) });
        } else {
            setCalendarConfig({ ...calendarConfig, monthly_days: [...days, day].sort((a, b) => a - b) });
        }
    };

    const addExclusionDate = (date: string) => {
        if (date && !calendarConfig.exclusion_dates.includes(date)) {
            setCalendarConfig({
                ...calendarConfig,
                exclusion_dates: [...calendarConfig.exclusion_dates, date].sort(),
            });
        }
    };

    const removeExclusionDate = (date: string) => {
        setCalendarConfig({
            ...calendarConfig,
            exclusion_dates: calendarConfig.exclusion_dates.filter(d => d !== date),
        });
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

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Icons.Search />
                    </span>
                    <input
                        type="text"
                        placeholder="Search schedules by name, report, type, status..."
                        className="input pl-10 w-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Schedules Grid */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                </div>
            ) : filteredSchedules && filteredSchedules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSchedules.map((schedule: any) => (
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
                                    {schedule.schedule_type === 'cron' && schedule.cron_expression ? (
                                        <p className="font-mono text-sm mt-1">{schedule.cron_expression}</p>
                                    ) : schedule.calendar_config ? (
                                        <div className="text-sm mt-1">
                                            <span className="capitalize font-medium text-indigo-600">
                                                {schedule.calendar_config.frequency}
                                            </span>
                                            {schedule.calendar_config.time_slots?.length > 0 && (
                                                <span className="text-gray-600">
                                                    {' '}@ {schedule.calendar_config.time_slots.join(', ')}
                                                </span>
                                            )}
                                            {schedule.calendar_config.exclusion_dates?.length > 0 && (
                                                <span className="text-red-500 text-xs ml-2">
                                                    ({schedule.calendar_config.exclusion_dates.length} blackout dates)
                                                </span>
                                            )}
                                        </div>
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
                                <button onClick={() => setToggleConfirmSchedule(schedule)} className="btn btn-ghost text-sm flex-1">
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
                                <button onClick={() => openEditModal(schedule)} className="btn btn-ghost text-sm" title="Edit schedule">
                                    <Icons.Edit />
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
                                    <div className="flex gap-2 mb-2 flex-wrap">
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

                            {formData.schedule_type === 'calendar' && (
                                <div className="space-y-4">
                                    {/* Frequency Selection */}
                                    <div>
                                        <label className="input-label">Frequency</label>
                                        <div className="flex gap-2">
                                            {['weekly', 'monthly', 'yearly'].map((freq) => (
                                                <button
                                                    key={freq}
                                                    type="button"
                                                    onClick={() => setCalendarConfig({ ...calendarConfig, frequency: freq })}
                                                    className={`px-4 py-2 rounded-lg border font-medium capitalize ${calendarConfig.frequency === freq
                                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {freq}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Weekly Day Selection */}
                                    {calendarConfig.frequency === 'weekly' && (
                                        <div>
                                            <label className="input-label">Run on Days</label>
                                            <div className="flex gap-1">
                                                {weekDays.map((day, idx) => (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={() => toggleWeekDay(idx)}
                                                        className={`w-12 h-10 rounded-lg border text-sm font-medium ${calendarConfig.weekly_days?.includes(idx)
                                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {day}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Monthly Day Selection */}
                                    {calendarConfig.frequency === 'monthly' && (
                                        <div>
                                            <label className="input-label">Run on Day(s) of Month</label>
                                            <div className="grid grid-cols-7 gap-1">
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={() => toggleMonthDay(day)}
                                                        className={`h-8 rounded text-sm ${calendarConfig.monthly_days?.includes(day)
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {day}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Yearly Date Input */}
                                    {calendarConfig.frequency === 'yearly' && (
                                        <div>
                                            <label className="input-label">Run on Date(s)</label>
                                            <p className="text-xs text-gray-500 mb-2">Format: MM-DD (e.g., 01-15 for Jan 15)</p>
                                            <div className="flex gap-2 flex-wrap">
                                                {calendarConfig.yearly_dates?.map((date, idx) => (
                                                    <span key={idx} className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm flex items-center gap-1">
                                                        {date}
                                                        <button onClick={() => {
                                                            setCalendarConfig({
                                                                ...calendarConfig,
                                                                yearly_dates: calendarConfig.yearly_dates?.filter((_, i) => i !== idx),
                                                            });
                                                        }} className="text-indigo-400 hover:text-indigo-700">×</button>
                                                    </span>
                                                ))}
                                                <input
                                                    type="text"
                                                    placeholder="MM-DD"
                                                    className="w-24 px-3 py-1 border rounded-lg text-sm"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const input = e.target as HTMLInputElement;
                                                            if (/^\d{2}-\d{2}$/.test(input.value)) {
                                                                setCalendarConfig({
                                                                    ...calendarConfig,
                                                                    yearly_dates: [...(calendarConfig.yearly_dates || []), input.value],
                                                                });
                                                                input.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Time Slots */}
                                    <div>
                                        <label className="input-label">Run at Time(s)</label>
                                        <div className="space-y-2">
                                            {calendarConfig.time_slots.map((slot, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <input
                                                        type="time"
                                                        className="input w-32"
                                                        value={slot}
                                                        onChange={(e) => updateTimeSlot(idx, e.target.value)}
                                                    />
                                                    {calendarConfig.time_slots.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeTimeSlot(idx)}
                                                            className="text-red-500 hover:text-red-700 p-1"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={addTimeSlot}
                                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                            >
                                                + Add Time
                                            </button>
                                        </div>
                                    </div>

                                    {/* Blackout Dates */}
                                    <div>
                                        <label className="input-label">Blackout Dates (Skip These Days)</label>
                                        <div className="flex gap-2 items-center mb-2">
                                            <input
                                                type="date"
                                                className="input w-40"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        addExclusionDate(e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                        </div>
                                        {calendarConfig.exclusion_dates.length > 0 && (
                                            <div className="flex gap-2 flex-wrap">
                                                {calendarConfig.exclusion_dates.map((date) => (
                                                    <span key={date} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-sm flex items-center gap-1">
                                                        {new Date(date).toLocaleDateString()}
                                                        <button onClick={() => removeExclusionDate(date)} className="text-red-400 hover:text-red-700">×</button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
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

            {/* Edit Modal */}
            {editingSchedule && (
                <div className="modal-overlay" onClick={() => setEditingSchedule(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Schedule</h3>
                            <button onClick={() => setEditingSchedule(null)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div>
                                <label className="input-label">Schedule Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                />
                            </div>
                            {editingSchedule.schedule_type === 'cron' && (
                                <div>
                                    <label className="input-label">Cron Expression</label>
                                    <input
                                        type="text"
                                        className="input font-mono"
                                        placeholder="0 6 * * *"
                                        value={editFormData.cron_expression}
                                        onChange={(e) => setEditFormData({ ...editFormData, cron_expression: e.target.value })}
                                    />
                                    <p className="input-helper">minute hour day month weekday</p>
                                </div>
                            )}
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">Report</p>
                                <p className="text-sm font-medium">{editingSchedule.report_name}</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setEditingSchedule(null)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button onClick={handleUpdate} disabled={updateMutation.isLoading} className="btn btn-primary">
                                {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toggle Confirmation Modal */}
            {toggleConfirmSchedule && (
                <div className="modal-overlay" onClick={() => setToggleConfirmSchedule(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {toggleConfirmSchedule.is_active ? 'Pause Schedule' : 'Enable Schedule'}
                            </h3>
                            <button onClick={() => setToggleConfirmSchedule(null)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                {toggleConfirmSchedule.is_active
                                    ? 'Are you sure you want to pause this schedule? It will stop running until re-enabled.'
                                    : 'Are you sure you want to enable this schedule? It will start running according to its configuration.'}
                            </p>
                            <div className="mt-4 p-3 bg-gray-50 rounded">
                                <div className="text-sm font-medium">{toggleConfirmSchedule.name}</div>
                                <div className="text-sm text-gray-500 mt-1">
                                    {toggleConfirmSchedule.cron_expression ||
                                        (toggleConfirmSchedule.calendar_config?.frequency
                                            ? `${toggleConfirmSchedule.calendar_config.frequency} schedule`
                                            : 'Calendar-based')}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setToggleConfirmSchedule(null)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleToggleConfirm}
                                disabled={toggleMutation.isLoading}
                                className={`btn ${toggleConfirmSchedule.is_active ? 'btn-warning bg-amber-500 hover:bg-amber-600' : 'btn-success bg-emerald-600 hover:bg-emerald-700'} text-white`}
                            >
                                {toggleMutation.isLoading ? 'Processing...' : (toggleConfirmSchedule.is_active ? 'Pause' : 'Enable')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
