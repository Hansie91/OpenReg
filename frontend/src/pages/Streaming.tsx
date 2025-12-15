import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { streamingAPI } from '../services/api';

// Icons
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Close: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
    Stream: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
};

interface StreamingTopic {
    id: string;
    name: string;
    description: string | null;
    bootstrap_servers: string;
    topic_name: string;
    consumer_group: string;
    auth_type: string;
    schema_format: string;
    is_active: boolean;
    created_at: string;
}

interface BufferStats {
    topic_id: string;
    topic_name: string;
    total_buffered: number;
    processed_count: number;
    pending_count: number;
    oldest_message: string | null;
    newest_message: string | null;
}

export default function Streaming() {
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<StreamingTopic | null>(null);
    const [testingTopic, setTestingTopic] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<any>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        bootstrap_servers: '',
        topic_name: '',
        consumer_group: 'openreg-consumer-group',
        auth_type: 'sasl_scram',
        sasl_username: '',
        sasl_password: '',
        sasl_mechanism: 'SCRAM-SHA-512',
        ssl_ca_cert: '',
        ssl_client_cert: '',
        ssl_client_key: '',
        schema_format: 'json',
        schema_registry_url: '',
        auto_offset_reset: 'earliest',
        max_poll_records: 500,
    });

    // Queries
    const { data: topics, isLoading } = useQuery('streaming-topics', () =>
        streamingAPI.listTopics().then(res => res.data)
    );

    const { data: bufferStats } = useQuery('buffer-stats', () =>
        streamingAPI.getBufferStats().then(res => res.data),
        { refetchInterval: 30000 }
    );

    // Mutations
    const createMutation = useMutation(
        (data: any) => streamingAPI.createTopic(data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('streaming-topics');
                closeModal();
            }
        }
    );

    const updateMutation = useMutation(
        ({ id, data }: { id: string; data: any }) => streamingAPI.updateTopic(id, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('streaming-topics');
                closeModal();
            }
        }
    );

    const deleteMutation = useMutation(
        (id: string) => streamingAPI.deleteTopic(id),
        {
            onSuccess: () => queryClient.invalidateQueries('streaming-topics')
        }
    );

    // Handlers
    const openCreateModal = () => {
        setFormData({
            name: '',
            description: '',
            bootstrap_servers: '',
            topic_name: '',
            consumer_group: 'openreg-consumer-group',
            auth_type: 'sasl_scram',
            sasl_username: '',
            sasl_password: '',
            sasl_mechanism: 'SCRAM-SHA-512',
            ssl_ca_cert: '',
            ssl_client_cert: '',
            ssl_client_key: '',
            schema_format: 'json',
            schema_registry_url: '',
            auto_offset_reset: 'earliest',
            max_poll_records: 500,
        });
        setShowCreateModal(true);
    };

    const openEditModal = (topic: StreamingTopic) => {
        setFormData({
            name: topic.name,
            description: topic.description || '',
            bootstrap_servers: topic.bootstrap_servers,
            topic_name: topic.topic_name,
            consumer_group: topic.consumer_group,
            auth_type: topic.auth_type,
            sasl_username: '',
            sasl_password: '',
            sasl_mechanism: 'SCRAM-SHA-512',
            ssl_ca_cert: '',
            ssl_client_cert: '',
            ssl_client_key: '',
            schema_format: topic.schema_format,
            schema_registry_url: '',
            auto_offset_reset: 'earliest',
            max_poll_records: 500,
        });
        setEditingTopic(topic);
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingTopic(null);
        setTestResult(null);
    };

    const handleSubmit = () => {
        if (editingTopic) {
            updateMutation.mutate({ id: editingTopic.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (topic: StreamingTopic) => {
        if (confirm(`Delete topic "${topic.name}"? This will remove all buffered messages.`)) {
            deleteMutation.mutate(topic.id);
        }
    };

    const handleTestConnection = async (topicId: string) => {
        setTestingTopic(topicId);
        setTestResult(null);
        try {
            const res = await streamingAPI.testConnection(topicId);
            setTestResult(res.data);
        } catch (err: any) {
            setTestResult({ success: false, message: err.response?.data?.detail || 'Test failed' });
        }
        setTestingTopic(null);
    };

    const getStatsForTopic = (topicId: string): BufferStats | undefined => {
        return bufferStats?.find((s: BufferStats) => s.topic_id === topicId);
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Streaming Topics</h1>
                    <p className="text-gray-500 mt-1">Manage Kafka/AMQ Streams connections for real-time data ingestion</p>
                </div>
                <button onClick={openCreateModal} className="btn btn-primary">
                    <Icons.Plus />
                    <span className="ml-2">Add Topic</span>
                </button>
            </div>

            {/* Topics Grid */}
            {isLoading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                </div>
            ) : topics?.length === 0 ? (
                <div className="card text-center py-12">
                    <Icons.Stream />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">No streaming topics</h3>
                    <p className="mt-2 text-gray-500">Get started by adding a Kafka or AMQ Streams topic.</p>
                    <button onClick={openCreateModal} className="btn btn-primary mt-4">
                        <Icons.Plus />
                        <span className="ml-2">Add Topic</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topics?.map((topic: StreamingTopic) => {
                        const stats = getStatsForTopic(topic.id);
                        return (
                            <div key={topic.id} className="card hover:shadow-lg transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${topic.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                                            <Icons.Stream />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{topic.name}</h3>
                                            <p className="text-xs text-gray-500">{topic.topic_name}</p>
                                        </div>
                                    </div>
                                    <span className={`badge ${topic.is_active ? 'badge-success' : 'badge-secondary'}`}>
                                        {topic.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Brokers</span>
                                        <span className="text-gray-900 font-mono text-xs truncate max-w-[180px]">
                                            {topic.bootstrap_servers}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Auth</span>
                                        <span className="text-gray-900 uppercase text-xs">{topic.auth_type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Schema</span>
                                        <span className="text-gray-900 uppercase text-xs">{topic.schema_format}</span>
                                    </div>
                                </div>

                                {/* Buffer Stats */}
                                {stats && (
                                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                        <div className="text-xs text-gray-500 mb-2">Buffer Status</div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <div className="text-lg font-bold text-gray-900">{stats.pending_count}</div>
                                                <div className="text-xs text-gray-500">Pending</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-green-600">{stats.processed_count}</div>
                                                <div className="text-xs text-gray-500">Processed</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-gray-600">{stats.total_buffered}</div>
                                                <div className="text-xs text-gray-500">Total</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleTestConnection(topic.id)}
                                        disabled={testingTopic === topic.id}
                                        className="btn btn-secondary btn-sm flex-1"
                                    >
                                        {testingTopic === topic.id ? (
                                            <span className="animate-spin">⟳</span>
                                        ) : (
                                            <Icons.Refresh />
                                        )}
                                        <span className="ml-1">Test</span>
                                    </button>
                                    <button onClick={() => openEditModal(topic)} className="btn btn-secondary btn-sm">
                                        <Icons.Edit />
                                    </button>
                                    <button onClick={() => handleDelete(topic)} className="btn btn-ghost btn-sm text-red-600">
                                        <Icons.Trash />
                                    </button>
                                </div>

                                {/* Test Result */}
                                {testResult && testingTopic === null && testResult.topic_id === topic.id && (
                                    <div className={`mt-3 p-2 rounded text-sm ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                        {testResult.success ? '✓ ' : '✗ '}{testResult.message}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || editingTopic) && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingTopic ? 'Edit Topic' : 'Add Streaming Topic'}</h3>
                            <button onClick={closeModal} className="btn btn-ghost btn-icon">
                                <Icons.Close />
                            </button>
                        </div>
                        <div className="modal-body space-y-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="input-label">Name *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="My Kafka Topic"
                                    />
                                </div>
                                <div>
                                    <label className="input-label">Topic Name *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={formData.topic_name}
                                        onChange={e => setFormData({ ...formData, topic_name: e.target.value })}
                                        placeholder="transactions.mifir"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="input-label">Bootstrap Servers *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.bootstrap_servers}
                                    onChange={e => setFormData({ ...formData, bootstrap_servers: e.target.value })}
                                    placeholder="broker1:9092,broker2:9092"
                                />
                            </div>

                            <div>
                                <label className="input-label">Consumer Group</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.consumer_group}
                                    onChange={e => setFormData({ ...formData, consumer_group: e.target.value })}
                                />
                            </div>

                            {/* Authentication */}
                            <div className="border-t pt-4">
                                <h4 className="font-medium text-gray-900 mb-3">Authentication</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="input-label">Auth Type</label>
                                        <select
                                            className="select"
                                            value={formData.auth_type}
                                            onChange={e => setFormData({ ...formData, auth_type: e.target.value })}
                                        >
                                            <option value="sasl_scram">SASL/SCRAM</option>
                                            <option value="sasl_plain">SASL/PLAIN</option>
                                            <option value="mtls">mTLS (Certificates)</option>
                                            <option value="none">None (Development)</option>
                                        </select>
                                    </div>
                                    {(formData.auth_type === 'sasl_scram' || formData.auth_type === 'sasl_plain') && (
                                        <div>
                                            <label className="input-label">SASL Mechanism</label>
                                            <select
                                                className="select"
                                                value={formData.sasl_mechanism}
                                                onChange={e => setFormData({ ...formData, sasl_mechanism: e.target.value })}
                                            >
                                                <option value="SCRAM-SHA-512">SCRAM-SHA-512</option>
                                                <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
                                                <option value="PLAIN">PLAIN</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {(formData.auth_type === 'sasl_scram' || formData.auth_type === 'sasl_plain') && (
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div>
                                            <label className="input-label">Username</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={formData.sasl_username}
                                                onChange={e => setFormData({ ...formData, sasl_username: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Password</label>
                                            <input
                                                type="password"
                                                className="input"
                                                value={formData.sasl_password}
                                                onChange={e => setFormData({ ...formData, sasl_password: e.target.value })}
                                                placeholder={editingTopic ? '(unchanged)' : ''}
                                            />
                                        </div>
                                    </div>
                                )}

                                {formData.auth_type === 'mtls' && (
                                    <div className="space-y-3 mt-4">
                                        <div>
                                            <label className="input-label">CA Certificate (PEM)</label>
                                            <textarea
                                                className="input h-20 font-mono text-xs"
                                                value={formData.ssl_ca_cert}
                                                onChange={e => setFormData({ ...formData, ssl_ca_cert: e.target.value })}
                                                placeholder="-----BEGIN CERTIFICATE-----"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Client Certificate (PEM)</label>
                                            <textarea
                                                className="input h-20 font-mono text-xs"
                                                value={formData.ssl_client_cert}
                                                onChange={e => setFormData({ ...formData, ssl_client_cert: e.target.value })}
                                                placeholder="-----BEGIN CERTIFICATE-----"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Client Key (PEM)</label>
                                            <textarea
                                                className="input h-20 font-mono text-xs"
                                                value={formData.ssl_client_key}
                                                onChange={e => setFormData({ ...formData, ssl_client_key: e.target.value })}
                                                placeholder="-----BEGIN PRIVATE KEY-----"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Schema */}
                            <div className="border-t pt-4">
                                <h4 className="font-medium text-gray-900 mb-3">Message Format</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="input-label">Schema Format</label>
                                        <select
                                            className="select"
                                            value={formData.schema_format}
                                            onChange={e => setFormData({ ...formData, schema_format: e.target.value })}
                                        >
                                            <option value="json">JSON</option>
                                            <option value="protobuf">Protobuf</option>
                                            <option value="avro">Avro</option>
                                            <option value="raw">Raw (String)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="input-label">Schema Registry URL</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.schema_registry_url}
                                            onChange={e => setFormData({ ...formData, schema_registry_url: e.target.value })}
                                            placeholder="http://schema-registry:8081"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={closeModal} className="btn btn-secondary">Cancel</button>
                            <button
                                onClick={handleSubmit}
                                disabled={createMutation.isLoading || updateMutation.isLoading}
                                className="btn btn-primary"
                            >
                                {(createMutation.isLoading || updateMutation.isLoading) ? 'Saving...' : (editingTopic ? 'Update' : 'Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
