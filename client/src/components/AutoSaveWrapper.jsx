import React from 'react';
import ReactFlow, { Background, Controls, MiniMap, useReactFlow } from 'reactflow';
import useStore from '../store';
import useAutoSave from '../hooks/useAutoSave';
import TerminalNode from './TerminalNode';
import TerminalEdge from './TerminalEdge';
import 'reactflow/dist/style.css';

const nodeTypes = {
    custom: TerminalNode,
    folder: TerminalNode,
};

const edgeTypes = {
    custom: TerminalEdge,
};

const AutoSaveWrapper = () => {
    const {
        nodes,
        edges,
        viewport,
        onNodesChange,
        onEdgesChange,
        onConnect,
        toggleFolder,
        openFile,
        setViewport, // Get the setViewport action from the store
    } = useStore();

    // This hook will now work correctly
    useAutoSave();

    const { setViewport: setRfViewport } = useReactFlow();

    const handleNodeClick = (event, node) => {
        if (node.type === 'folder') {
            toggleFolder(node.id);
        } else {
            openFile(node.id, node.data.label);
        }
    };

    // When the viewport from the store changes (on initial load), update React Flow's viewport
    React.useEffect(() => {
        if (viewport) {
            setRfViewport(viewport);
        }
    }, [viewport, setRfViewport]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onMove={(_, newViewport) => setViewport(newViewport)} // Corrected: use onMove and pass newViewport
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.1}
            maxZoom={4}
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
    );
};

export default AutoSaveWrapper;
