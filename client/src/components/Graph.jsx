import React, { useEffect, useCallback } from 'react';
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    MiniMap,
    ReactFlowProvider,
    useReactFlow
} from 'reactflow';


import { Loader2 } from 'lucide-react';
import 'reactflow/dist/style.css';
import useStore from '../store';
import CustomNode from './CustomNode';
import FolderNode from './FolderNode';
import EmptyState from './EmptyState';


const nodeTypes = {
    custom: CustomNode,
    folder: FolderNode,
};


// Inner component that uses the hook
const GraphContent = () => {
    const { nodes, edges, fetchGraph, onNodesChange, onEdgesChange, highlightDependencies, loading } = useStore();
    const { fitView } = useReactFlow();

    useEffect(() => {
        fetchGraph();
        const interval = setInterval(() => fetchGraph(true), 10000);
        return () => clearInterval(interval);
    }, [fetchGraph]);

    // On mount or when significant structure changes, fit view
    useEffect(() => {
        if (nodes.length > 0 && !loading) {
            setTimeout(() => {
                fitView({ padding: 0.2, duration: 800 });
            }, 100);
        }
    }, [nodes.length, loading, fitView]);

    const onNodeMouseEnter = useCallback((event, node) => {
        highlightDependencies(node.id);
    }, [highlightDependencies]);

    const onNodeMouseLeave = useCallback(() => {
        highlightDependencies(null);
    }, [highlightDependencies]);

    return (
        <div style={{ height: '100vh', width: '100vw' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseLeave={onNodeMouseLeave}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
            >
                <Background gap={16} color="#334155" />
                <Controls className="bg-slate-800 text-white border-slate-700" />
                <MiniMap
                    nodeStrokeColor={(n) => '#64748b'}
                    nodeColor={(n) => '#1e293b'}
                    maskColor="rgba(15, 23, 42, 0.6)"
                    className="bg-slate-900 border border-slate-800"
                />
            </ReactFlow>

            {loading && (
                <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="flex flex-col items-center">
                        <Loader2 className="animate-spin text-blue-400 mb-2" size={32} />
                        <span className="text-slate-200 text-sm">Analyzing codebase...</span>
                    </div>
                </div>
            )}

            {!loading && nodes.length === 0 && <EmptyState />}
        </div>
    );
};

const Graph = () => (
    <ReactFlowProvider>
        <GraphContent />
    </ReactFlowProvider>
);

export default Graph;

