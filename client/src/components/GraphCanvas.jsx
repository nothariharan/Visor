import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useReactFlow } from 'reactflow';
import useStore from '../store';
import TerminalNode from './TerminalNode';
import TerminalEdge from './TerminalEdge';
import Loader from './Loader';
import useAutoSave from '../hooks/useAutoSave';
import 'reactflow/dist/style.css';

const nodeTypes = {
    custom: TerminalNode,
    folder: TerminalNode,
    default: TerminalNode, // Fallback
};

const edgeTypes = {
    custom: TerminalEdge,
    default: TerminalEdge, // Fallback
};

export default function GraphCanvas({ mode }) {
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        organizeGraph,
        fetchGraph,
        toggleFolder,
        openFile,
        loading: storeLoading,
        error,
        highlightDependencies,
        viewport,
        setViewport
    } = useStore();

    useAutoSave();
    const { setViewport: setRfViewport } = useReactFlow();
    const hasSyncedRef = useRef(false);

    useEffect(() => {
        if (viewport && !hasSyncedRef.current) {
            setRfViewport(viewport);
            hasSyncedRef.current = true;
        }
    }, [viewport, setRfViewport]);

    const [isFlowReady, setIsFlowReady] = useState(false);

    // Mode switching effect
    useEffect(() => {
        if (mode === 'skeleton' || mode === 'forge') {
            organizeGraph('critical');
        } else {
            organizeGraph('all');
        }
    }, [mode, organizeGraph]);

    // Initial fetch
    useEffect(() => {
        fetchGraph();
    }, [fetchGraph]);

    const handleNodeClick = (event, node) => {
        if (node.type === 'folder') {
            toggleFolder(node.id);
        } else {
            openFile(node.id, node.data.label);
        }
    };

    const handleInit = useCallback(() => {
        // Give React Flow a bit more time to settle
        setTimeout(() => {
            setIsFlowReady(true);
        }, 250);
    }, []);

    // Final "Are we ready?" check
    const isActuallyReady = !storeLoading && isFlowReady && nodes.length > 0;

    if (error) {
        return <div className="h-full w-full bg-mantle flex items-center justify-center text-red">Error: {error}</div>;
    }

    return (
        <div className="h-full w-full relative overflow-hidden bg-base">
            {/* The Loader Overlay - Stays on top while loading */}
            {!isActuallyReady ? (
                <div className="absolute inset-0 z-50">
                    <Loader />
                </div>
            ) : null}

            {/* The Graph - Mounted in background, fades in when ready */}
            <div
                className={`h-full w-full transition-opacity duration-1000 ${isActuallyReady ? 'opacity-100' : 'opacity-0'}`}
                style={{ visibility: isActuallyReady ? 'visible' : 'hidden' }}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={handleNodeClick}
                    onInit={handleInit}
                    onMoveEnd={(_, viewport) => useStore.getState().setViewport(viewport)}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodeMouseEnter={(_, node) => highlightDependencies(node.id)}
                    onNodeMouseLeave={() => highlightDependencies(null)}
                    fitView
                    minZoom={0.1}
                    maxZoom={4}
                    panOnDrag={[0]} // Left-click for panning
                    panOnScroll={false}
                    zoomOnScroll={true}
                    zoomOnPinch={true}
                    zoomOnDoubleClick={true}
                    selectionOnDrag={false}
                    selectionKeyCode="Control"
                    nodesDraggable={true}
                    nodesConnectable={true}
                    elementsSelectable={true}
                    defaultEdgeOptions={{
                        type: 'custom',
                        animated: true,
                        style: { stroke: '#45475a', strokeWidth: 2 }
                    }}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background
                        color="#45475a"
                        gap={20}
                        size={1}
                        variant="dots"
                    />
                    <Controls
                        className="!bg-surface0 !border-surface1 !rounded-none !shadow-hard"
                    />
                    <MiniMap
                        nodeColor={(node) => {
                            if (node.data?.status === 'error') return '#f38ba8';
                            if (node.data?.status === 'executing') return '#a6e3a1';
                            if (node.type === 'folder') return '#89b4fa';
                            return '#313244';
                        }}
                        className="!bg-surface0 !border-surface1 !rounded-none"
                        maskColor="rgba(24, 24, 37, 0.7)"
                    />
                </ReactFlow>
            </div>
        </div>
    );
}
