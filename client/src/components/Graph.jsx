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


import { Loader2, Zap, LayoutGrid, Eye, EyeOff, Rocket, Star } from 'lucide-react';
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
    const { nodes, edges, fetchGraph, onNodesChange, onEdgesChange, highlightDependencies, loading,
        organizeGraph, organizeMode, organizeStats } = useStore();
    const { fitView } = useReactFlow();

    useEffect(() => {
        fetchGraph();
        const interval = setInterval(() => fetchGraph(true), 10000);
        return () => clearInterval(interval);
    }, [fetchGraph]);

    const hasLoadedRef = React.useRef(false);

    // On mount or when significant structure changes, fit view
    useEffect(() => {
        if (nodes.length > 0 && !loading && !hasLoadedRef.current) {
            // Give a small delay for layout to settle
            setTimeout(() => {
                fitView({ padding: 0.2, duration: 800 });
                hasLoadedRef.current = true;
            }, 100);
        }
    }, [nodes.length, loading, fitView]);


    const onNodeMouseEnter = useCallback((event, node) => {
        highlightDependencies(node.id);
    }, [highlightDependencies]);

    const onNodeMouseLeave = useCallback(() => {
        highlightDependencies(null);
    }, [highlightDependencies]);

    const handleOrganize = useCallback((mode) => {
        organizeGraph(mode);
        // Fit view after filter to focus on visible nodes
        setTimeout(() => fitView({ padding: 0.3, duration: 600 }), 50);
    }, [organizeGraph, fitView]);

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

            {/* ===== Organize Toolbar ===== */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
                <div className="flex items-center bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-xl px-1.5 py-1.5 shadow-2xl">
                    <button
                        onClick={() => handleOrganize('all')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${organizeMode === 'all'
                            ? 'bg-slate-600 text-white shadow-inner'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            }`}
                    >
                        <LayoutGrid size={16} />
                        Show All
                    </button>
                    <button
                        onClick={() => handleOrganize('critical')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${organizeMode === 'critical'
                            ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 border border-amber-500/30 shadow-inner shadow-amber-500/10'
                            : 'text-slate-400 hover:text-amber-300 hover:bg-amber-500/10'
                            }`}
                    >
                        <Zap size={16} />
                        Critical Path
                    </button>
                </div>

                {/* Stats badge when organized */}
                {organizeStats && organizeMode === 'critical' && (
                    <div className="flex items-center gap-3 bg-slate-800/90 backdrop-blur-md border border-amber-500/30 rounded-xl px-4 py-2 text-sm shadow-2xl">
                        <span className="text-amber-300 font-bold">
                            {organizeStats.critical} <span className="text-slate-400 font-normal">/ {organizeStats.total} files</span>
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className="text-emerald-400 flex items-center gap-1"><Rocket size={13} /> {organizeStats.entryPoints} entry</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-violet-400 flex items-center gap-1"><Star size={13} /> {organizeStats.centralNodes} core</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-400">
                            <EyeOff size={13} className="inline mr-1" />
                            {organizeStats.hidden} hidden
                        </span>
                    </div>
                )}
            </div>

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

