import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { destinationsAPI } from '../services/api';

// Icons
const Icons = {
    Plus: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),
    Send: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
        </svg>
    ),
    Close: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    ),
    Test: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
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
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
    ),
};

// Demo destinations
const demoDestinations = [
    {
        id: '1',
        name: 'FCA SFTP Gateway',
        type: 'sftp',
        host: 'sftp.fca.org.uk',
        port: 22,
        username: 'firm_user',
        directory: '/reports/mifir/',
        is_active: true,
        last_delivery_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        last_status: 'success',
    },
    {
        id: '2',
        name: 'Internal Archive',
        type: 'sftp',
        host: 'archive.internal.com',
        port: 22,
        username: 'reports_user',
        directory: '/archive/regulatory/',
        is_active: true,
        last_delivery_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        last_status: 'success',
    },
    {
        id: '3',
        name: 'Legacy FTP Server',
        type: 'ftp',
        host: 'ftp.legacy.internal',
        port: 21,
        username: 'legacy_user',
        directory: '/incoming/',
        is_active: false,
        last_delivery_at: null,
        last_status: null,
    },
];

export default function Destinations() {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [testLoading, setTestLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: 'sftp',
        host: '',
        port: '22',
        username: '',
        password: '',
        directory: '/',
        retry_count: '3',
    });

    const { data: destinations, isLoading } = useQuery('destinations', () =>
        destinationsAPI.list().then((res) => res.data)
    );

    const displayDestinations = destinations && destinations.length > 0 ? destinations : demoDestinations;

    const handleTypeChange = (type: string) => {
        setFormData({
            ...formData,
            type,
            port: type === 'sftp' ? '22' : '21',
        });
    };

    const handleTest = async () => {
        setTestLoading(true);
        setTestResult(null);
        try {
            await destinationsAPI.test({
                type: formData.type,
                host: formData.host,
                port: parseInt(formData.port),
                username: formData.username,
                password: formData.password,
                directory: formData.directory,
            });
            setTestResult({ success: true, message: 'Connection successful!' });
        } catch (err: any) {
            setTestResult({
                success: false,
                message: err.response?.data?.detail || 'Connection failed',
            });
        } finally {
            setTestLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="page-title">Delivery Destinations</h1>
                    <p className="page-description">
                        Configure SFTP and FTP destinations for report delivery
                    </p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                    <Icons.Plus />
                    <span className="ml-2">Add Destination</span>
                </button>
            </div>

            {/* Destinations Grid */}
            {isLoading ? (
                <div className="card p-12 text-center">
                    <div className="spinner mx-auto text-indigo-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayDestinations.map((dest: any) => (
                        <div key={dest.id} className="card">
                            <div className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{dest.type === 'sftp' ? '🔒' : '📁'}</span>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{dest.name}</h3>
                                            <span className={`badge ${dest.type === 'sftp' ? 'badge-info' : 'badge-gray'}`}>
                                                {dest.type.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`badge ${dest.is_active ? 'badge-success' : 'badge-gray'}`}>
                                        {dest.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div className="mt-4 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Host</span>
                                        <span className="font-mono">{dest.host}:{dest.port}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Directory</span>
                                        <span className="font-mono">{dest.directory}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Last Delivery</span>
                                        <span className="flex items-center gap-1">
                                            {dest.last_status === 'success' && (
                                                <span className="text-emerald-600"><Icons.Check /></span>
                                            )}
                                            {dest.last_delivery_at
                                                ? new Date(dest.last_delivery_at).toLocaleDateString()
                                                : '—'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                                <button className="btn btn-ghost text-sm">
                                    <Icons.Test />
                                    <span className="ml-1">Test</span>
                                </button>
                                <button className="btn btn-ghost text-sm">
                                    <Icons.Edit />
                                    <span className="ml-1">Edit</span>
                                </button>
                                <button className="btn btn-ghost text-red-600 hover:bg-red-50 text-sm">
                                    <Icons.Trash />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Destination</h3>
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Name *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="FCA SFTP Gateway"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Protocol</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleTypeChange('sftp')}
                                            className={`flex-1 py-2.5 rounded-lg border-2 font-medium transition-all ${formData.type === 'sftp'
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            🔒 SFTP
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleTypeChange('ftp')}
                                            className={`flex-1 py-2.5 rounded-lg border-2 font-medium transition-all ${formData.type === 'ftp'
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            📁 FTP
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <h4 className="text-sm font-medium text-gray-700 mb-4">Connection Details</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <label className="input-label">Host *</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="sftp.example.com"
                                            value={formData.host}
                                            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label">Port</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.port}
                                            onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="input-label">Username *</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="user"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label">Password *</label>
                                        <input
                                            type="password"
                                            className="input"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="input-label">Remote Directory</label>
                                        <input
                                            type="text"
                                            className="input font-mono"
                                            placeholder="/reports/"
                                            value={formData.directory}
                                            onChange={(e) => setFormData({ ...formData, directory: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label">Retry Count</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={formData.retry_count}
                                            onChange={(e) => setFormData({ ...formData, retry_count: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {testResult && (
                                <div className={`p-4 rounded-lg ${testResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                                    <div className="flex items-center gap-2">
                                        {testResult.success ? <Icons.Check /> : <Icons.Close />}
                                        <span className="font-medium">{testResult.message}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                onClick={handleTest}
                                disabled={testLoading || !formData.host}
                                className="btn btn-secondary"
                            >
                                {testLoading ? 'Testing...' : 'Test Connection'}
                            </button>
                            <div className="flex-1"></div>
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                                Cancel
                            </button>
                            <button className="btn btn-primary">
                                Create Destination
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
