import { useQuery } from 'react-query';
import { runsAPI, reportsAPI, connectorsAPI } from '../services/api';
import { Link } from 'react-router-dom';

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
};

export default function Dashboard() {
    const { data: runs, isLoading: runsLoading } = useQuery('recent-runs', () =>
        runsAPI.list().then((res) => res.data)
    );

    const { data: reports } = useQuery('reports-count', () =>
        reportsAPI.list().then((res) => res.data)
    );

    const { data: connectors } = useQuery('connectors-count', () =>
        connectorsAPI.list().then((res) => res.data)
    );

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
            default:
                return <span className="badge badge-gray">{status}</span>;
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-description">
                    Overview of your regulatory reporting activity
                </p>
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

            {/* Recent Runs */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Job Runs</h2>
                    <Link to="/runs" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                        View all
                        <Icons.ArrowRight />
                    </Link>
                </div>

                {runsLoading ? (
                    <div className="card p-8 text-center">
                        <div className="spinner mx-auto text-indigo-600"></div>
                        <p className="mt-3 text-sm text-gray-500">Loading runs...</p>
                    </div>
                ) : runs && runs.length > 0 ? (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Run ID</th>
                                    <th>Status</th>
                                    <th>Triggered By</th>
                                    <th>Created</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.slice(0, 5).map((run: any) => (
                                    <tr key={run.id}>
                                        <td className="font-mono text-sm">{run.id.slice(0, 8)}...</td>
                                        <td>{getStatusBadge(run.status)}</td>
                                        <td className="capitalize">{run.triggered_by}</td>
                                        <td>{new Date(run.created_at).toLocaleString()}</td>
                                        <td>
                                            {run.ended_at && run.started_at
                                                ? `${Math.round((new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                                                : '-'
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <Icons.Reports />
                        <h3 className="empty-state-title">No runs yet</h3>
                        <p className="empty-state-description">Execute a report to see results here</p>
                        <Link to="/reports" className="btn btn-primary mt-4">
                            Go to Reports
                        </Link>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="mt-8 card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start Guide</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-semibold mb-3">1</div>
                        <h3 className="font-medium text-gray-900">Add a Connector</h3>
                        <p className="text-sm text-gray-500 mt-1">Connect to your database source</p>
                        <Link to="/connectors" className="text-sm text-indigo-600 font-medium mt-2 inline-block hover:text-indigo-700">
                            Add Connector →
                        </Link>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-semibold mb-3">2</div>
                        <h3 className="font-medium text-gray-900">Create a Report</h3>
                        <p className="text-sm text-gray-500 mt-1">Define your transformation logic</p>
                        <Link to="/reports" className="text-sm text-emerald-600 font-medium mt-2 inline-block hover:text-emerald-700">
                            Create Report →
                        </Link>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-semibold mb-3">3</div>
                        <h3 className="font-medium text-gray-900">Execute & Deliver</h3>
                        <p className="text-sm text-gray-500 mt-1">Run reports and send to regulators</p>
                        <Link to="/destinations" className="text-sm text-purple-600 font-medium mt-2 inline-block hover:text-purple-700">
                            Set Destinations →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
