import React, { useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import useStore from '../store';
import TerminalNode from './TerminalNode';
import TerminalEdge from './TerminalEdge';
import 'reactflow/dist/style.css'; // Ensure basic styles are present

const nodeTypes = {
    custom: TerminalNode,
    folder: TerminalNode,
};

const edgeTypes = {
    custom: TerminalEdge,
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
        toggleFolder, // Get toggleFolder from store
        openFile      // Get openFile from store
    } = useStore();

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
            toggleFolder(node.id); // Toggle folder expansion
        } else {
            openFile(node.id, node.data.label); // Open file in editor
        }
    };

    return (
        <div className="h-full w-full bg-mantle">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick} // Attach handler
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
                        // Match TerminalNode status colors
                        if (node.data?.status === 'error') return '#f38ba8'; // Red
                        if (node.data?.status === 'executing') return '#a6e3a1'; // Green
                        if (node.type === 'folder') return '#89b4fa'; // Blue
                        return '#313244'; // Surface0
                    }}
                    className="!bg-surface0 !border-surface1 !rounded-none"
                    maskColor="rgba(24, 24, 37, 0.7)" // mantle with opacity
                />
            </ReactFlow>
        </div>
    );
}
