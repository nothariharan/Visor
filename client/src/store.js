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
        if (!isBackground) {
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
                // Background update: Preserve user positions exactly
                const currentNodes = get().nodes;
                const positionMap = new Map(currentNodes.map(n => [n.id, n.position]));
                mergedNodes = incomingNodes.map(newNode => {
                    const existingPos = positionMap.get(newNode.id);
                    return existingPos ? { ...newNode, position: existingPos } : newNode;
                });
            } else if (oldAnchorNode) {
                // Layout Update with Anchor: Center-Based Anchoring
                // const oldAnchorNode = nodes.find(n => n.id === anchorNodeId); // Use nodes captured at start of function? No, need original nodes including width
                // Actually, I need to capture old dimensions before fetch
                // But I only captured position. Need width/height too.

                // Let's rely on stored node list `nodes` since we haven't mutated it yet? No, `get().nodes` is current.
                // The `nodes` variable on line 85 holds the state at start of function.

                const newAnchorNode = incomingNodes.find(n => n.id === anchorNodeId);

                if (newAnchorNode && oldAnchorNode) {
                    // Fallback dimensions if missing
                    const oldW = oldAnchorNode.data?.width || oldAnchorNode.width || 150;
                    const oldH = oldAnchorNode.data?.height || oldAnchorNode.height || 60;

                    const newW = newAnchorNode.data?.width || newAnchorNode.width || 150;
                    const newH = newAnchorNode.data?.height || newAnchorNode.height || 60;

                    const oldCenterX = oldAnchorNode.position.x + oldW / 2;
                    const oldCenterY = oldAnchorNode.position.y + oldH / 2;

                    // Desired top-left for new node so its center matches old center
                    const desiredX = oldCenterX - newW / 2;
                    const desiredY = oldCenterY - newH / 2;

                    const dx = desiredX - newAnchorNode.position.x;
                    const dy = desiredY - newAnchorNode.position.y;

                    mergedNodes = incomingNodes.map(n => {
                        // Only shift root nodes (no parent) to move the whole "world"
                        // Children move with their parents automatically
                        if (!n.parentNode) {
                            return {
                                ...n,
                                position: { x: n.position.x + dx, y: n.position.y + dy }
                            };
                        }
                        return n;
                    });

                }
            }


            // Set initial opacity for edges
            const edgesWithStyle = (res.data.edges || []).map(e => ({
                ...e,
                style: { ...e.style, opacity: 0.4, stroke: '#b1b1b7' }
            }));

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
            set({
                edges: edges.map(edge => ({
                    ...edge,
                    style: { stroke: '#b1b1b7', strokeWidth: 1, opacity: 0.4 },
                    animated: false
                })),
                nodes: nodes.map(node => ({
                    ...node,
                    style: { ...node.style, opacity: 1, filter: 'none', zIndex: 1 }
                }))

            });
            return;
        }

        // Find relevant edges (excluding hierarchy/structure edges)
        edges.forEach(edge => {
            if (edge.id.startsWith('hierarchy-')) return; // Ignore folder-child structure

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
                    ? { stroke: '#2563eb', strokeWidth: 2, opacity: 1 }
                    : { stroke: '#e5e7eb', strokeWidth: 1, opacity: 0.2 },
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
