import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { adminAPI } from '../services/api';

// Icons
const Icons = {
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    Users: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
    ),
    Shield: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
    ),
    Clock: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
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
};

// Demo users
const demoUsers = [
    { id: '1', email: 'admin@example.com', full_name: 'Admin User', role: 'Administrator', is_active: true, created_at: '2024-01-01' },
    { id: '2', email: 'analyst@example.com', full_name: 'Jane Analyst', role: 'Analyst', is_active: true, created_at: '2024-01-15' },
    { id: '3', email: 'viewer@example.com', full_name: 'John Viewer', role: 'Viewer', is_active: false, created_at: '2024-02-01' },
];

// Demo audit logs
const demoAuditLogs = [
    { id: '1', action: 'report.executed', user_email: 'admin@example.com', resource: 'MiFIR Report', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
    { id: '2', action: 'connector.created', user_email: 'admin@example.com', resource: 'Production DB', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
    { id: '3', action: 'user.login', user_email: 'admin@example.com', resource: null, timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
    { id: '4', action: 'schedule.updated', user_email: 'analyst@example.com', resource: 'Daily MiFIR', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    { id: '5', action: 'mapping.created', user_email: 'admin@example.com', resource: 'Venue Codes', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
];

const demoRoles = [
    { id: '1', name: 'Administrator', permissions: ['*'], users_count: 1 },
    { id: '2', name: 'Analyst', permissions: ['reports:read', 'reports:execute', 'runs:read'], users_count: 1 },
    { id: '3', name: 'Viewer', permissions: ['reports:read', 'runs:read'], users_count: 1 },
];

type TabType = 'users' | 'roles' | 'audit';

export default function Admin() {
    const [activeTab, setActiveTab] = useState<TabType>('users');
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [userFormData, setUserFormData] = useState({
        email: '',
        full_name: '',
        password: '',
        role_id: '',
    });

    const { data: users, isLoading: usersLoading } = useQuery('admin-users', () =>
        adminAPI.listUsers().then((res) => res.data)
    );

    const { data: roles, isLoading: rolesLoading } = useQuery('admin-roles', () =>
        adminAPI.listRoles().then((res) => res.data)
    );

    const { data: auditLogs, isLoading: auditsLoading } = useQuery('admin-audit', () =>
        adminAPI.getAuditLogs().then((res) => res.data)
    );

    const displayUsers = users && users.length > 0 ? users : demoUsers;
    const displayRoles = roles && roles.length > 0 ? roles : demoRoles;
    const displayAuditLogs = auditLogs && auditLogs.length > 0 ? auditLogs : demoAuditLogs;

    const tabs = [
        { id: 'users' as TabType, label: 'Users', icon: Icons.Users },
        { id: 'roles' as TabType, label: 'Roles', icon: Icons.Shield },
        { id: 'audit' as TabType, label: 'Audit Log', icon: Icons.Clock },
    ];

    const formatAction = (action: string) => {
        return action.replace('.', ' → ').replace(/([A-Z])/g, ' $1').trim();
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="page-header">
                <h1 className="page-title">Administration</h1>
                <p className="page-description">
                    Manage users, roles, and view audit logs
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
                        </button>
                    );
                })}
            </div>

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div>
                    <div className="flex justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                        <button onClick={() => setShowCreateUserModal(true)} className="btn btn-primary">
                            <Icons.Plus />
                            <span className="ml-2">Add User</span>
                        </button>
                    </div>

                    {usersLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayUsers.map((user: any) => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                                                        {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{user.full_name}</p>
                                                        <p className="text-sm text-gray-500">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge badge-info">{user.role}</span>
                                            </td>
                                            <td>
                                                <span className={`badge ${user.is_active ? 'badge-success' : 'badge-gray'}`}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="text-gray-500">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <div className="flex gap-1">
                                                    <button className="btn btn-ghost btn-icon text-indigo-600">
                                                        <Icons.Edit />
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon text-red-600">
                                                        <Icons.Trash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Roles Tab */}
            {activeTab === 'roles' && (
                <div>
                    <div className="flex justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Role Management</h2>
                        <button className="btn btn-primary">
                            <Icons.Plus />
                            <span className="ml-2">Add Role</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {displayRoles.map((role: any) => (
                            <div key={role.id} className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-gray-900">{role.name}</h3>
                                    <span className="badge badge-gray">{role.users_count} users</span>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Permissions</p>
                                    <div className="flex flex-wrap gap-1">
                                        {role.permissions.slice(0, 4).map((perm: string) => (
                                            <span key={perm} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                {perm}
                                            </span>
                                        ))}
                                        {role.permissions.length > 4 && (
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                +{role.permissions.length - 4} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                                    <button className="btn btn-ghost text-sm flex-1">Edit</button>
                                    <button className="btn btn-ghost text-sm text-red-600 hover:bg-red-50">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
                        <p className="text-sm text-gray-500">Track all actions in the system</p>
                    </div>

                    {auditsLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>User</th>
                                        <th>Resource</th>
                                        <th>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayAuditLogs.map((log: any) => (
                                        <tr key={log.id}>
                                            <td>
                                                <span className="badge badge-info capitalize">
                                                    {formatAction(log.action)}
                                                </span>
                                            </td>
                                            <td className="text-gray-600">{log.user_email}</td>
                                            <td>{log.resource || '—'}</td>
                                            <td className="text-gray-500">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Create User Modal */}
            {showCreateUserModal && (
                <div className="modal-overlay" onClick={() => setShowCreateUserModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add User</h3>
                            <button onClick={() => setShowCreateUserModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div>
                                <label className="input-label">Email *</label>
                                <input
                                    type="email"
                                    className="input"
                                    placeholder="user@example.com"
                                    value={userFormData.email}
                                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Full Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="John Doe"
                                    value={userFormData.full_name}
                                    onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Password *</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="••••••••"
                                    value={userFormData.password}
                                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Role *</label>
                                <select
                                    className="select"
                                    value={userFormData.role_id}
                                    onChange={(e) => setUserFormData({ ...userFormData, role_id: e.target.value })}
                                >
                                    <option value="">Select a role...</option>
                                    {displayRoles.map((role: any) => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCreateUserModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button className="btn btn-primary">
                                Create User
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
