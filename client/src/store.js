import { create } from 'zustand';
import axios from 'axios';
import { applyNodeChanges, applyEdgeChanges } from 'reactflow';

const useStore = create((set, get) => ({
    nodes: [],
    edges: [],
    adjacency: {}, // Map<NodeId, { imports: [], importedBy: [] }>
    loading: false,
    error: null,
    expandedFolders: new Set(),
    focusedNode: null,

    // Actions
    toggleFolder: (folderId) => {
        const { expandedFolders, fetchGraph } = get();
        const newSet = new Set(expandedFolders);
        if (newSet.has(folderId)) {
            newSet.delete(folderId);
        } else {
            newSet.add(folderId);
        }
        set({ expandedFolders: newSet });
        fetchGraph(false, folderId); // Pass false for isBackground, and folderId as anchor
    },


    expandPaths: (paths) => {
        const { expandedFolders, fetchGraph } = get();
        const newSet = new Set(expandedFolders);
        paths.forEach(p => newSet.add(p));
        set({ expandedFolders: newSet });
        fetchGraph();
    },

    setFocusedNode: (nodeId) => {
        const { nodes, edges, adjacency, focusedNode } = get();

        // If clicking same node, toggle off
        const targetId = focusedNode === nodeId ? null : nodeId;

        set({ focusedNode: targetId });

        if (!targetId) {
            // Unhide all
            set({
                nodes: nodes.map(n => ({ ...n, hidden: false, style: { ...n.style, opacity: 1 } })),
                edges: edges.map(e => ({ ...e, hidden: false, style: { ...e.style, opacity: 0.4 } }))
            });
            return;
        }

        // Find neighbors
        const neighbors = new Set();
        neighbors.add(targetId);
        const adj = adjacency[targetId];
        if (adj) {
            adj.imports.forEach(id => neighbors.add(id));
            adj.importedBy.forEach(id => neighbors.add(id));
        }

        // Update visibility
        set({
            nodes: nodes.map(n => ({
                ...n,
                hidden: !neighbors.has(n.id),
                style: { ...n.style, opacity: 1 }
            })),
            edges: edges.map(e => {
                const works = neighbors.has(e.source) && neighbors.has(e.target);
                return {
                    ...e,
                    hidden: !works,
                    style: { ...e.style, opacity: 1 }
                };
            })
        });
    },

    fetchGraph: async (isBackground = false, anchorNodeId = null) => {
        if (!isBackground && !anchorNodeId) {
            // Only show loading spinner on initial load, not folder toggles
            set({ loading: true, error: null });
        }
        try {
            const { expandedFolders, nodes } = get();

            // Capture anchor node data before fetch if provided
            let oldAnchorNode = null;
            if (anchorNodeId) {
                oldAnchorNode = nodes.find(n => n.id === anchorNodeId);
            }


            const res = await axios.post('/api/graph', {
                expandedFolders: Array.from(expandedFolders)
            });

            const incomingNodes = res.data.nodes || [];
            let mergedNodes = incomingNodes;

            if (isBackground) {
                // Background: Preserve all positions
                const currentNodes = get().nodes;
                const positionMap = new Map(currentNodes.map(n => [n.id, n.position]));
                mergedNodes = incomingNodes.map(newNode => {
                    const existingPos = positionMap.get(newNode.id);
                    return existingPos ? { ...newNode, position: existingPos } : newNode;
                });
            } else if (oldAnchorNode && anchorNodeId) {
                // Interactive Mode: User placement is KING
                // ALL existing nodes keep their exact positions
                // Only brand new nodes get positioned near the anchor
                const currentNodes = get().nodes;
                const oldNodeMap = new Map(currentNodes.map(n => [n.id, n]));

                let newRootCount = 0; // Track new root nodes for stacking

                mergedNodes = incomingNodes.map(newNode => {
                    const oldNode = oldNodeMap.get(newNode.id);

                    if (oldNode) {
                        // Existing node: ALWAYS preserve user position, allow size to update
                        return { ...newNode, position: oldNode.position };
                    }

                    // Brand new node
                    if (!newNode.parentNode) {
                        // New root-level node (detached sub-directory): place near anchor
                        const anchorRight = oldAnchorNode.position.x + (oldAnchorNode.width || 250) + 100;
                        const anchorY = oldAnchorNode.position.y + (newRootCount * 120);
                        newRootCount++;
                        return {
                            ...newNode,
                            position: { x: anchorRight, y: anchorY }
                        };
                    }

                    // New child node (file inside folder): use ELK relative position
                    return newNode;
                });

            } else {
                // First load or full reset
                mergedNodes = incomingNodes;
            }


            // Set initial styles for edges
            // Hierarchy edges: bright cyan dashed
            // Dependency edges: keep server-sent color-coded styles
            const edgesWithStyle = (res.data.edges || []).map(e => {
                if (e.id.startsWith('hierarchy-')) {
                    return { ...e, style: { stroke: '#38bdf8', strokeWidth: 2.5, opacity: 1, strokeDasharray: '8,4' } };
                }
                // dep-* edges already have style from server, just adjust opacity
                return { ...e, style: { ...e.style, opacity: 0.6 } };
            });

            set({
                nodes: mergedNodes,
                edges: edgesWithStyle,
                adjacency: res.data.adjacency || {},
                loading: false,
                focusedNode: isBackground ? get().focusedNode : null
            });

        } catch (err) {
            set({ error: err.message, loading: false });
        }
    },



    onNodesChange: (changes) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
        });
    },

    onEdgesChange: (changes) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },

    // Hover Logic (Adjacency Cache)
    highlightDependencies: (nodeId) => {
        const { adjacency, edges, focusedNode, nodes } = get();

        // If focused, hover shouldn't override focus visibility, only highlight style?
        // Actually, if focused, we only see neighbors. Hovering a neighbor should highlight its connection to focus?
        // Let's keep it simple: if focusedNode is set, disable hover logic or restrict it.
        if (focusedNode) return;

        if (!nodeId) {
            // Reset styles
            // Restore original edge styles (un-highlight)
            set({
                edges: edges.map(edge => ({
                    ...edge,
                    style: edge.id.startsWith('hierarchy-')
                        ? { stroke: '#38bdf8', strokeWidth: 2.5, opacity: 1, strokeDasharray: '8,4' }
                        : { ...edge.style, opacity: 0.6 },
                    animated: false
                })),
                nodes: nodes.map(node => ({
                    ...node,
                    style: { ...node.style, opacity: 1, filter: 'none', zIndex: 1 }
                }))
            });
            return;
        }

        // Find relevant edges (including hierarchy/structure edges)
        edges.forEach(edge => {
            // Include hierarchy edges in highlight logic
            if (edge.source === nodeId || edge.target === nodeId) {
                connectedEdgeIds.add(edge.id);
                connectedNodeIds.add(edge.source);
                connectedNodeIds.add(edge.target);
            }
        });



        set({
            edges: edges.map(edge => ({
                ...edge,
                style: connectedEdgeIds.has(edge.id)
                    ? {
                        stroke: edge.style?.stroke || '#2563eb', // Preserve original color!
                        strokeWidth: 3,
                        opacity: 1,
                        strokeDasharray: edge.id.startsWith('hierarchy-') ? '5,5' : edge.style?.strokeDasharray,
                        filter: 'drop-shadow(0 0 4px ' + (edge.style?.stroke || '#2563eb') + ')'
                    }
                    : { ...edge.style, strokeWidth: 1, opacity: 0.08 },
                animated: connectedEdgeIds.has(edge.id)
            })),
            nodes: nodes.map(node => ({
                ...node,
                style: connectedNodeIds.has(node.id)
                    ? { ...node.style, opacity: 1, filter: 'drop-shadow(0 0 6px #3b82f6)', zIndex: 10 }
                    : { ...node.style, opacity: 1, filter: 'none', zIndex: 1 }
            }))
        });

    }
}));

export default useStore;
