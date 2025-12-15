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
    Heart: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
        </svg>
    ),
};

// User interface
interface User {
    id: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
    is_superuser: boolean;
    role_id: string | null;
    role_name: string | null;
    created_at: string;
}

// Role interface
interface Role {
    id: string;
    name: string;
    description: string | null;
    permissions: string[];
    user_count: number;
    created_at: string;
}

type TabType = 'users' | 'roles' | 'audit' | 'health';

export default function Admin() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<TabType>('users');
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userFormData, setUserFormData] = useState({
        email: '',
        full_name: '',
        password: '',
        is_superuser: false,
        is_active: true,
        role_id: '' as string | null,
    });

    // Role management state
    const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
    const [showEditRoleModal, setShowEditRoleModal] = useState(false);
    const [showDeleteRoleConfirm, setShowDeleteRoleConfirm] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [roleFormData, setRoleFormData] = useState({
        name: '',
        description: '',
        permissions: [] as string[],
    });

    // Audit filter state
    const [auditFilters, setAuditFilters] = useState({
        entity_type: undefined as string | undefined,
        action: undefined as string | undefined,
        skip: 0,
        limit: 50
    });

    // Get current user to check admin status
    const { data: currentUser } = useQuery('admin-current-user', () =>
        adminAPI.getCurrentUser().then((res) => res.data)
    );
    const isAdmin = currentUser?.is_superuser ?? false;

    const { data: users, isLoading: usersLoading } = useQuery('admin-users', () =>
        adminAPI.listUsers().then((res) => res.data)
    );

    const { data: roles, isLoading: rolesLoading } = useQuery('admin-roles', () =>
        adminAPI.listRoles().then((res) => res.data)
    );

    const { data: auditData, isLoading: auditsLoading } = useQuery(['admin-audit', auditFilters], () =>
        adminAPI.getAuditLogs(auditFilters).then((res) => res.data)
    );

    const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery('admin-health', () =>
        adminAPI.getSystemHealth().then((res) => res.data),
        { refetchInterval: 30000 }
    );

    // Mutations
    const createUserMutation = useMutation(
        (data: any) => adminAPI.createUser(data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('admin-users');
                setShowCreateUserModal(false);
                setUserFormData({ email: '', full_name: '', password: '', is_superuser: false, is_active: true, role_id: '' });
                alert('User created successfully');
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to create user');
            }
        }
    );

    const updateUserMutation = useMutation(
        ({ id, data }: { id: string; data: any }) => adminAPI.updateUser(id, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('admin-users');
                setShowEditUserModal(false);
                setSelectedUser(null);
                alert('User updated successfully');
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to update user');
            }
        }
    );

    const deleteUserMutation = useMutation(
        (id: string) => adminAPI.deleteUser(id),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('admin-users');
                setShowDeleteConfirm(false);
                setSelectedUser(null);
                alert('User deleted successfully');
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to delete user');
            }
        }
    );

    const handleCreateUser = () => {
        if (!userFormData.email || !userFormData.password) {
            alert('Email and password are required');
            return;
        }
        createUserMutation.mutate({
            ...userFormData,
            role_id: userFormData.role_id || null
        });
    };

    const handleEditUser = (user: User) => {
        setSelectedUser(user);
        setUserFormData({
            email: user.email,
            full_name: user.full_name || '',
            password: '',
            is_superuser: user.is_superuser,
            is_active: user.is_active,
            role_id: user.role_id || '',
        });
        setShowEditUserModal(true);
    };

    const handleUpdateUser = () => {
        if (!selectedUser) return;
        const updateData: any = {};
        if (userFormData.email !== selectedUser.email) updateData.email = userFormData.email;
        if (userFormData.full_name !== (selectedUser.full_name || '')) updateData.full_name = userFormData.full_name;
        if (userFormData.is_superuser !== selectedUser.is_superuser) updateData.is_superuser = userFormData.is_superuser;
        if (userFormData.is_active !== selectedUser.is_active) updateData.is_active = userFormData.is_active;
        if (userFormData.password) updateData.password = userFormData.password;
        // Always send role_id if changed
        if (userFormData.role_id !== (selectedUser.role_id || '')) {
            updateData.role_id = userFormData.role_id || null;
        }

        updateUserMutation.mutate({ id: selectedUser.id, data: updateData });
    };

    const handleDeleteClick = (user: User) => {
        setSelectedUser(user);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = () => {
        if (selectedUser) {
            deleteUserMutation.mutate(selectedUser.id);
        }
    };

    const tabs = [
        { id: 'users' as TabType, label: 'Users', icon: Icons.Users },
        { id: 'roles' as TabType, label: 'Roles', icon: Icons.Shield },
        { id: 'audit' as TabType, label: 'Audit Log', icon: Icons.Clock },
        { id: 'health' as TabType, label: 'System Health', icon: Icons.Heart },
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
                        {isAdmin && (
                            <button onClick={() => setShowCreateUserModal(true)} className="btn btn-primary">
                                <Icons.Plus />
                                <span className="ml-2">Add User</span>
                            </button>
                        )}
                    </div>

                    {usersLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : users && users.length > 0 ? (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        {isAdmin && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user: User) => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                                                        {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{user.full_name || user.email}</p>
                                                        <p className="text-sm text-gray-500">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-col gap-1">
                                                    {user.is_superuser && (
                                                        <span className="badge badge-warning">Administrator</span>
                                                    )}
                                                    {user.role_name ? (
                                                        <span className="badge badge-info">{user.role_name}</span>
                                                    ) : !user.is_superuser && (
                                                        <span className="badge badge-gray">No role</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${user.is_active ? 'badge-success' : 'badge-gray'}`}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="text-gray-500">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            {isAdmin && (
                                                <td>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleEditUser(user)}
                                                            className="btn btn-ghost btn-icon text-indigo-600"
                                                            title="Edit User"
                                                        >
                                                            <Icons.Edit />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(user)}
                                                            className="btn btn-ghost btn-icon text-red-600"
                                                            title="Delete User"
                                                            disabled={user.id === currentUser?.id}
                                                        >
                                                            <Icons.Trash />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="text-gray-300 mx-auto">
                                <Icons.Users />
                            </div>
                            <h3 className="empty-state-title">No users found</h3>
                            <p className="empty-state-description">
                                Add users to manage access to the system
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Roles Tab */}
            {activeTab === 'roles' && (
                <div>
                    <div className="flex justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Role Management</h2>
                        {isAdmin && (
                            <button onClick={() => setShowCreateRoleModal(true)} className="btn btn-primary">
                                <Icons.Plus />
                                <span className="ml-2">Add Role</span>
                            </button>
                        )}
                    </div>

                    {rolesLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : roles && roles.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {roles.map((role: Role) => (
                                <div key={role.id} className="card p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-gray-900">{role.name}</h3>
                                        <span className="badge badge-gray">{role.user_count} user{role.user_count !== 1 ? 's' : ''}</span>
                                    </div>
                                    {role.description && (
                                        <p className="text-sm text-gray-500 mb-4">{role.description}</p>
                                    )}
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-gray-500 uppercase">Permissions</p>
                                        <div className="flex flex-wrap gap-1">
                                            {role.permissions.length > 0 ? (
                                                <>
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
                                                </>
                                            ) : (
                                                <span className="text-sm text-gray-400">No permissions defined</span>
                                            )}
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedRole(role);
                                                    setRoleFormData({
                                                        name: role.name,
                                                        description: role.description || '',
                                                        permissions: role.permissions || []
                                                    });
                                                    setShowEditRoleModal(true);
                                                }}
                                                className="btn btn-ghost text-sm flex-1"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedRole(role);
                                                    setShowDeleteRoleConfirm(true);
                                                }}
                                                className="btn btn-ghost text-sm text-red-600 hover:bg-red-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="text-gray-300 mx-auto">
                                <Icons.Shield />
                            </div>
                            <h3 className="empty-state-title">No roles defined</h3>
                            <p className="empty-state-description">
                                Create roles to organize user permissions
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit' && (
                <div>
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
                        <p className="text-sm text-gray-500">Track all actions in the system</p>
                    </div>

                    {/* Filters */}
                    <div className="card p-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="input-label">Entity Type</label>
                                <select
                                    className="select text-sm"
                                    value={auditFilters.entity_type || ''}
                                    onChange={(e) => setAuditFilters({ ...auditFilters, entity_type: e.target.value || undefined, skip: 0 })}
                                >
                                    <option value="">All Types</option>
                                    <option value="Report">Report</option>
                                    <option value="Connector">Connector</option>
                                    <option value="User">User</option>
                                    <option value="ReportVersion">Report Version</option>
                                    <option value="Mapping">Mapping</option>
                                </select>
                            </div>

                            <div>
                                <label className="input-label">Action</label>
                                <select
                                    className="select text-sm"
                                    value={auditFilters.action || ''}
                                    onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value || undefined, skip: 0 })}
                                >
                                    <option value="">All Actions</option>
                                    <option value="create">Create</option>
                                    <option value="update">Update</option>
                                    <option value="delete">Delete</option>
                                    <option value="execute">Execute</option>
                                </select>
                            </div>

                            <div>
                                <label className="input-label">Results</label>
                                <select
                                    className="select text-sm"
                                    value={auditFilters.limit}
                                    onChange={(e) => setAuditFilters({ ...auditFilters, limit: Number(e.target.value), skip: 0 })}
                                >
                                    <option value="25">25 per page</option>
                                    <option value="50">50 per page</option>
                                    <option value="100">100 per page</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {auditsLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : auditData && auditData.data && auditData.data.length > 0 ? (
                        <>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Action</th>
                                            <th>Entity</th>
                                            <th>User</th>
                                            <th>Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditData.data.map((log: any) => (
                                            <tr key={log.id}>
                                                <td>
                                                    <span className={`badge ${log.action === 'create' ? 'badge-success' :
                                                        log.action === 'delete' ? 'badge-danger' :
                                                            log.action === 'execute' ? 'badge-info' :
                                                                'badge-warning'
                                                        } capitalize`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{log.entity_type}</p>
                                                        {log.entity_id && (
                                                            <p className="text-xs text-gray-500 font-mono">{log.entity_id.substring(0, 8)}...</p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-gray-600">
                                                    {log.user_email || 'System'}
                                                    {log.user_name && (
                                                        <p className="text-xs text-gray-500">{log.user_name}</p>
                                                    )}
                                                </td>
                                                <td className="text-gray-500 text-sm">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="card p-4 mt-4">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-gray-600">
                                        Showing {auditFilters.skip + 1} to {Math.min(auditFilters.skip + auditFilters.limit, auditData.total)} of {auditData.total} results
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setAuditFilters({ ...auditFilters, skip: Math.max(0, auditFilters.skip - auditFilters.limit) })}
                                            disabled={auditFilters.skip === 0}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setAuditFilters({ ...auditFilters, skip: auditFilters.skip + auditFilters.limit })}
                                            disabled={auditFilters.skip + auditFilters.limit >= auditData.total}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="text-gray-300 mx-auto">
                                <Icons.Clock />
                            </div>
                            <h3 className="empty-state-title">No audit logs yet</h3>
                            <p className="empty-state-description">
                                Activity will appear here as actions are performed in the system
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* System Health Tab */}
            {activeTab === 'health' && (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
                            <p className="text-sm text-gray-500">Monitor system status and performance metrics</p>
                        </div>
                        <button onClick={() => refetchHealth()} className="btn btn-secondary btn-sm">
                            Refresh
                        </button>
                    </div>

                    {healthLoading ? (
                        <div className="card p-12 text-center">
                            <div className="spinner mx-auto text-indigo-600"></div>
                        </div>
                    ) : healthData ? (
                        <div className="space-y-6">
                            {/* Overall Status */}
                            <div className="card p-6">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${healthData.status === 'healthy' ? 'bg-green-100' : 'bg-yellow-100'
                                        }`}>
                                        <Icons.Heart />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 capitalize">{healthData.status}</h3>
                                        <p className="text-sm text-gray-500">
                                            Last checked: {new Date(healthData.timestamp).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    <span className={`ml-auto badge ${healthData.status === 'healthy' ? 'badge-success' : 'badge-warning'
                                        }`}>
                                        {healthData.status === 'healthy' ? 'All Systems Operational' : 'Degraded'}
                                    </span>
                                </div>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Database */}
                                <div className="card p-5">
                                    <h4 className="text-sm font-medium text-gray-500 mb-3">Database</h4>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-3 h-3 rounded-full ${healthData.database?.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                                            }`}></span>
                                        <span className="font-medium text-gray-900 capitalize">
                                            {healthData.database?.status || 'Unknown'}
                                        </span>
                                    </div>
                                    {healthData.database?.latency_ms && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            Latency: {healthData.database.latency_ms}ms
                                        </p>
                                    )}
                                </div>

                                {/* CPU */}
                                <div className="card p-5">
                                    <h4 className="text-sm font-medium text-gray-500 mb-3">CPU Usage</h4>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {healthData.system?.cpu_percent ?? '—'}%
                                    </p>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                        <div
                                            className={`h-2 rounded-full ${(healthData.system?.cpu_percent || 0) > 80 ? 'bg-red-500' :
                                                    (healthData.system?.cpu_percent || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${healthData.system?.cpu_percent || 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Memory */}
                                <div className="card p-5">
                                    <h4 className="text-sm font-medium text-gray-500 mb-3">Memory Usage</h4>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {healthData.system?.memory_percent ?? '—'}%
                                    </p>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                        <div
                                            className={`h-2 rounded-full ${(healthData.system?.memory_percent || 0) > 85 ? 'bg-red-500' :
                                                    (healthData.system?.memory_percent || 0) > 70 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${healthData.system?.memory_percent || 0}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {healthData.system?.memory_used_gb} / {healthData.system?.memory_total_gb} GB
                                    </p>
                                </div>

                                {/* Disk */}
                                <div className="card p-5">
                                    <h4 className="text-sm font-medium text-gray-500 mb-3">Disk Usage</h4>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {healthData.system?.disk_percent ?? '—'}%
                                    </p>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                        <div
                                            className={`h-2 rounded-full ${(healthData.system?.disk_percent || 0) > 90 ? 'bg-red-500' :
                                                    (healthData.system?.disk_percent || 0) > 75 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${healthData.system?.disk_percent || 0}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {healthData.system?.disk_used_gb} / {healthData.system?.disk_total_gb} GB
                                    </p>
                                </div>

                                {/* Jobs (24h) */}
                                <div className="card p-5">
                                    <h4 className="text-sm font-medium text-gray-500 mb-3">Jobs (24h)</h4>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {healthData.jobs?.last_24h_total || 0}
                                    </p>
                                    {healthData.jobs?.by_status && (
                                        <div className="flex gap-2 mt-2 flex-wrap">
                                            {Object.entries(healthData.jobs.by_status).map(([status, count]) => (
                                                <span key={status} className={`text-xs px-2 py-0.5 rounded ${status === 'success' ? 'bg-green-100 text-green-700' :
                                                    status === 'failed' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {status}: {count as number}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Avg Duration */}
                                <div className="card p-5">
                                    <h4 className="text-sm font-medium text-gray-500 mb-3">Avg Job Duration</h4>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {healthData.jobs?.avg_duration_ms
                                            ? `${(healthData.jobs.avg_duration_ms / 1000).toFixed(1)}s`
                                            : '—'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2">Based on successful jobs</p>
                                </div>

                                {/* Streaming */}
                                <div className="card p-5">
                                    <h4 className="text-sm font-medium text-gray-500 mb-3">Streaming Topics</h4>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {healthData.streaming?.active_topics || 0}
                                    </p>
                                    {healthData.streaming?.topics?.length > 0 && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            Pending: {healthData.streaming.topics.reduce((sum: number, t: any) => sum + t.pending_messages, 0)} messages
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Entity Counts */}
                            <div className="card p-6">
                                <h4 className="text-sm font-medium text-gray-500 mb-4">System Entities</h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {healthData.entities && Object.entries(healthData.entities).map(([key, count]) => (
                                        <div key={key} className="text-center p-3 bg-gray-50 rounded-lg">
                                            <p className="text-2xl font-bold text-gray-900">{count as number}</p>
                                            <p className="text-xs text-gray-500 capitalize">{key.replace('_', ' ')}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Streaming Details */}
                            {healthData.streaming?.topics?.length > 0 && (
                                <div className="card p-6">
                                    <h4 className="text-sm font-medium text-gray-500 mb-4">Streaming Buffer Status</h4>
                                    <div className="space-y-3">
                                        {healthData.streaming.topics.map((topic: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <span className="font-medium text-gray-900">{topic.topic}</span>
                                                <span className={`badge ${topic.pending_messages > 1000 ? 'badge-warning' : 'badge-success'
                                                    }`}>
                                                    {topic.pending_messages.toLocaleString()} pending
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="text-gray-300 mx-auto">
                                <Icons.Heart />
                            </div>
                            <h3 className="empty-state-title">Unable to load health data</h3>
                            <p className="empty-state-description">
                                Try refreshing the page
                            </p>
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
                                <label className="input-label">Full Name</label>
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
                                <label className="input-label">Role</label>
                                <select
                                    className="select"
                                    value={userFormData.role_id || ''}
                                    onChange={(e) => setUserFormData({ ...userFormData, role_id: e.target.value || null })}
                                >
                                    <option value="">No role assigned</option>
                                    {roles?.map((role: Role) => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_superuser"
                                    checked={userFormData.is_superuser}
                                    onChange={(e) => setUserFormData({ ...userFormData, is_superuser: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="is_superuser" className="text-sm text-gray-700">
                                    Grant Administrator privileges
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCreateUserModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateUser}
                                className="btn btn-primary"
                                disabled={createUserMutation.isLoading}
                            >
                                {createUserMutation.isLoading ? 'Creating...' : 'Create User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditUserModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowEditUserModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit User</h3>
                            <button onClick={() => setShowEditUserModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div>
                                <label className="input-label">Email</label>
                                <input
                                    type="email"
                                    className="input"
                                    value={userFormData.email}
                                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Full Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={userFormData.full_name}
                                    onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">New Password (leave blank to keep current)</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="••••••••"
                                    value={userFormData.password}
                                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Role</label>
                                <select
                                    className="select"
                                    value={userFormData.role_id || ''}
                                    onChange={(e) => setUserFormData({ ...userFormData, role_id: e.target.value || null })}
                                >
                                    <option value="">No role assigned</option>
                                    {roles?.map((role: Role) => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="edit_is_superuser"
                                    checked={userFormData.is_superuser}
                                    onChange={(e) => setUserFormData({ ...userFormData, is_superuser: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="edit_is_superuser" className="text-sm text-gray-700">
                                    Administrator privileges
                                </label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="edit_is_active"
                                    checked={userFormData.is_active}
                                    onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="edit_is_active" className="text-sm text-gray-700">
                                    Active (uncheck to deactivate user)
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowEditUserModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateUser}
                                className="btn btn-primary"
                                disabled={updateUserMutation.isLoading}
                            >
                                {updateUserMutation.isLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title text-red-600">Delete User</h3>
                            <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600">
                                Are you sure you want to delete <strong>{selectedUser.full_name || selectedUser.email}</strong>?
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="btn btn-danger"
                                disabled={deleteUserMutation.isLoading}
                            >
                                {deleteUserMutation.isLoading ? 'Deleting...' : 'Delete User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Role Modal */}
            {showCreateRoleModal && (
                <div className="modal-overlay" onClick={() => setShowCreateRoleModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Role</h3>
                            <button onClick={() => setShowCreateRoleModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div>
                                <label className="input-label">Role Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. Analyst, Viewer"
                                    value={roleFormData.name}
                                    onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="Describe what this role is for..."
                                    value={roleFormData.description}
                                    onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Permissions (comma-separated)</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. reports:read, runs:execute"
                                    value={roleFormData.permissions.join(', ')}
                                    onChange={(e) => setRoleFormData({
                                        ...roleFormData,
                                        permissions: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                                    })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCreateRoleModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!roleFormData.name) {
                                        alert('Role name is required');
                                        return;
                                    }
                                    try {
                                        await adminAPI.createRole(roleFormData);
                                        queryClient.invalidateQueries('admin-roles');
                                        setShowCreateRoleModal(false);
                                        setRoleFormData({ name: '', description: '', permissions: [] });
                                        alert('Role created successfully');
                                    } catch (err: any) {
                                        alert(err.response?.data?.detail || 'Failed to create role');
                                    }
                                }}
                                className="btn btn-primary"
                            >
                                Create Role
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Role Modal */}
            {showEditRoleModal && selectedRole && (
                <div className="modal-overlay" onClick={() => setShowEditRoleModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Role</h3>
                            <button onClick={() => setShowEditRoleModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div>
                                <label className="input-label">Role Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={roleFormData.name}
                                    onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={roleFormData.description}
                                    onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Permissions (comma-separated)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={roleFormData.permissions.join(', ')}
                                    onChange={(e) => setRoleFormData({
                                        ...roleFormData,
                                        permissions: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                                    })}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowEditRoleModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!roleFormData.name) {
                                        alert('Role name is required');
                                        return;
                                    }
                                    try {
                                        await adminAPI.updateRole(selectedRole.id, roleFormData);
                                        queryClient.invalidateQueries('admin-roles');
                                        queryClient.invalidateQueries('admin-users');
                                        setShowEditRoleModal(false);
                                        setSelectedRole(null);
                                        alert('Role updated successfully');
                                    } catch (err: any) {
                                        alert(err.response?.data?.detail || 'Failed to update role');
                                    }
                                }}
                                className="btn btn-primary"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Role Confirmation Modal */}
            {showDeleteRoleConfirm && selectedRole && (
                <div className="modal-overlay" onClick={() => setShowDeleteRoleConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title text-red-600">Delete Role</h3>
                            <button onClick={() => setShowDeleteRoleConfirm(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600">
                                Are you sure you want to delete the role <strong>{selectedRole.name}</strong>?
                            </p>
                            {selectedRole.user_count > 0 && (
                                <p className="text-sm text-amber-600 mt-2">
                                    Warning: {selectedRole.user_count} user(s) have this role assigned. They will be unassigned.
                                </p>
                            )}
                            <p className="text-sm text-gray-500 mt-2">
                                This action cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteRoleConfirm(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await adminAPI.deleteRole(selectedRole.id);
                                        queryClient.invalidateQueries('admin-roles');
                                        queryClient.invalidateQueries('admin-users');
                                        setShowDeleteRoleConfirm(false);
                                        setSelectedRole(null);
                                        alert('Role deleted successfully');
                                    } catch (err: any) {
                                        alert(err.response?.data?.detail || 'Failed to delete role');
                                    }
                                }}
                                className="btn btn-danger"
                            >
                                Delete Role
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
