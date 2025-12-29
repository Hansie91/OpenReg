/**
 * Data Lineage Graph Component
 * 
 * Visualizes data flow from sources (connectors, mappings) through reports.
 * Uses React Flow for interactive graph rendering.
 * 
 * Phase 1: High-level report ↔ connector relationships
 * Phase 2: Field-level column mappings (future)
 */

import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    ConnectionMode,
    MarkerType,
    Handle,
    Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Custom node styles based on type
const nodeStyles = {
    connector: {
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        color: 'white',
        border: '2px solid #1e40af',
        borderRadius: '12px',
        padding: '16px',
        minWidth: '180px',
    },
    report: {
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: 'white',
        border: '2px solid #047857',
        borderRadius: '12px',
        padding: '16px',
        minWidth: '180px',
    },
    mapping_set: {
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
        color: 'white',
        border: '2px solid #5b21b6',
        borderRadius: '12px',
        padding: '16px',
        minWidth: '180px',
    },
    destination: {
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: 'white',
        border: '2px solid #b45309',
        borderRadius: '12px',
        padding: '16px',
        minWidth: '180px',
    },
};

// Icons for different node types
const NodeIcons = {
    connector: (
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
    ),
    report: (
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    mapping_set: (
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
    ),
    destination: (
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
    ),
};

// Custom node component
function LineageNodeComponent({ data, type }: { data: any; type: string }) {
    const style = nodeStyles[type as keyof typeof nodeStyles] || nodeStyles.connector;
    const icon = NodeIcons[type as keyof typeof NodeIcons] || NodeIcons.connector;

    return (
        <div style={style} className="shadow-lg relative">
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-gray-400" />
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-gray-400" />
            <div className="flex items-center font-semibold text-sm mb-1">
                {icon}
                <span>{data.label}</span>
            </div>
            {data.description && (
                <div className="text-xs opacity-80 mt-1 line-clamp-2">
                    {data.description}
                </div>
            )}
            {data.metadata && Object.keys(data.metadata).length > 0 && (
                <div className="text-xs opacity-70 mt-2 pt-2 border-t border-white/20">
                    {data.metadata.db_type && (
                        <span className="inline-block bg-white/20 px-2 py-0.5 rounded mr-1">
                            {data.metadata.db_type}
                        </span>
                    )}
                    {data.metadata.version && (
                        <span className="inline-block bg-white/20 px-2 py-0.5 rounded">
                            {data.metadata.version}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// Node types for React Flow
const nodeTypes = {
    connector: (props: any) => <LineageNodeComponent {...props} type="connector" />,
    report: (props: any) => <LineageNodeComponent {...props} type="report" />,
    mapping_set: (props: any) => <LineageNodeComponent {...props} type="mapping_set" />,
    destination: (props: any) => <LineageNodeComponent {...props} type="destination" />,
};

interface LineageGraphProps {
    nodes: any[];
    edges: any[];
    onNodeClick?: (node: any) => void;
    onEdgeClick?: (edge: any) => void;
}

export default function LineageGraph({ nodes: initialNodes, edges: initialEdges, onNodeClick, onEdgeClick }: LineageGraphProps) {
    // Transform nodes for React Flow
    const processedNodes = useMemo(() => {
        // Auto-layout: arrange nodes in columns by type
        const connectorNodes = initialNodes.filter(n => n.type === 'connector');
        const mappingNodes = initialNodes.filter(n => n.type === 'mapping_set');
        const reportNodes = initialNodes.filter(n => n.type === 'report');
        const destinationNodes = initialNodes.filter(n => n.type === 'destination');

        let result: Node[] = [];
        const columnWidth = 280;
        const rowHeight = 120;

        // Column 0: Connectors
        connectorNodes.forEach((node, idx) => {
            result.push({
                ...node,
                position: node.position.x === 0 && node.position.y === 0
                    ? { x: 0, y: idx * rowHeight }
                    : node.position,
            });
        });

        // Column 1: Mapping Sets
        mappingNodes.forEach((node, idx) => {
            result.push({
                ...node,
                position: node.position.x === 0 && node.position.y === 0
                    ? { x: columnWidth, y: idx * rowHeight }
                    : node.position,
            });
        });

        // Column 2: Reports
        reportNodes.forEach((node, idx) => {
            result.push({
                ...node,
                position: node.position.x === 0 && node.position.y === 0
                    ? { x: columnWidth * 2, y: idx * rowHeight }
                    : node.position,
            });
        });

        // Column 3: Destinations
        destinationNodes.forEach((node, idx) => {
            result.push({
                ...node,
                position: node.position.x === 0 && node.position.y === 0
                    ? { x: columnWidth * 3, y: idx * rowHeight }
                    : node.position,
            });
        });

        return result;
    }, [initialNodes]);

    // Transform edges for React Flow
    const processedEdges = useMemo(() => {
        return initialEdges.map((edge: any) => ({
            ...edge,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: '#6366f1',
            },
            style: {
                stroke: '#6366f1',
                strokeWidth: 2,
            },
            labelStyle: {
                fill: '#4b5563',
                fontSize: 11,
                fontWeight: 500,
            },
            labelBgStyle: {
                fill: '#f3f4f6',
                fillOpacity: 0.8,
            },
        }));
    }, [initialEdges]);

    const [nodes, setNodes, onNodesChange] = useNodesState(processedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(processedEdges);

    // Sync state with props
    useEffect(() => {
        setNodes(processedNodes);
    }, [processedNodes, setNodes]);

    useEffect(() => {
        setEdges(processedEdges);
    }, [processedEdges, setEdges]);

    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (onNodeClick) {
            onNodeClick(node);
        }
    }, [onNodeClick]);

    if (nodes.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <p className="text-lg font-medium">No lineage data available</p>
                    <p className="text-sm mt-1">Save a report with a connector to see data lineage</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full" style={{ minHeight: '400px' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onEdgeClick={onEdgeClick ? (evt, edge) => onEdgeClick(edge) : undefined}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                attributionPosition="bottom-left"
            >
                <Background color="#e5e7eb" gap={20} />
                <Controls />
                <MiniMap
                    nodeColor={(node) => {
                        switch (node.type) {
                            case 'connector': return '#3b82f6';
                            case 'report': return '#10b981';
                            case 'mapping_set': return '#8b5cf6';
                            case 'destination': return '#f59e0b';
                            default: return '#6b7280';
                        }
                    }}
                    maskColor="rgba(0, 0, 0, 0.1)"
                />
            </ReactFlow>
        </div>
    );
}
