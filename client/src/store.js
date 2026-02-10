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
    organizeMode: 'all', // 'all' | 'critical'
    organizeStats: null,  // { total, critical, hidden, entryPoints, centralNodes }

    // ===== ORGANIZE: Critical Path Filter (100% client-side) =====
    organizeGraph: (mode) => {
        const { nodes, edges, adjacency } = get();

        if (mode === 'all') {
            // Show everything
            set({
                organizeMode: 'all',
                organizeStats: null,
                nodes: nodes.map(n => ({
                    ...n,
                    hidden: false,
                    data: { ...n.data, isEntryPoint: false, isCentral: false, criticalReason: null }
                })),
                edges: edges.map(e => ({ ...e, hidden: false }))
            });
            return;
        }

        // --- Critical Path Algorithm ---
        const critical = new Set();

        // Only source code files can be part of the critical path
        const SOURCE_EXTENSIONS = /\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte)$/i;

        // Files that are NEVER critical (config, data, docs, logs, etc.)
        const NON_CRITICAL_PATTERNS = [
            /\.(txt|md|log|csv|yml|yaml|toml|xml|lock)$/i,     // Data/doc files
            /\.(json)$/i,                                        // JSON (package.json etc.)
            /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|mp4|mp3)$/i,  // Assets
            /\.(css|scss|sass|less|styl)$/i,                     // Stylesheets (not entry points)
            /\.(env|env\..*)$/i,                                 // Environment files
            /\.config\.(js|ts|mjs|cjs)$/i,                       // Config files (vite.config, etc.)
            /visor\.config/i,                                     // Visor config
            /package(-lock)?\.json$/i,                            // Package files
            /tsconfig.*\.json$/i,                                 // TypeScript config
            /\.eslintrc/i, /\.prettierrc/i, /\.babelrc/i,        // Linter/formatter config
            /webpack\.config/i, /rollup\.config/i,                // Bundler configs
        ];

        // 1. Find entry points
        const entryPatterns = [
            /index\.(js|jsx|ts|tsx|mjs|cjs)$/i,
            /main\.(js|jsx|ts|tsx)$/i,
            /[/\\]App\.(js|jsx|ts|tsx)$/i,
            /[/\\]app\.(js|jsx|ts|tsx)$/i,
            /_app\.(js|jsx|ts|tsx)$/i,
            /_document\.(js|jsx|ts|tsx)$/i,
            /server\.(js|ts)$/i,
        ];
        const supplementaryPatterns = [
            /\.test\.(js|jsx|ts|tsx)$/i,
            /\.spec\.(js|jsx|ts|tsx)$/i,
            /\.stories\.(js|jsx|ts|tsx)$/i,
            /\.mock\.(js|jsx|ts|tsx)$/i,
            /__tests__[/\\]/i,
            /__mocks__[/\\]/i,
            /\.d\.ts$/i,
            /debug\.(js|ts)$/i,     // Debug scripts
        ];

        const isSourceCode = (id) => SOURCE_EXTENSIONS.test(id) && !NON_CRITICAL_PATTERNS.some(p => p.test(id));

        const entryPoints = [];
        const fileNodes = nodes.filter(n => n.type === 'custom');
        const sourceNodes = fileNodes.filter(n => isSourceCode(n.id));

        sourceNodes.forEach(node => {
            // Skip test/mock/debug files
            if (supplementaryPatterns.some(p => p.test(node.id))) return;

            const isNamed = entryPatterns.some(p => p.test(node.id));
            const adj = adjacency[node.id];
            const hasNoImporters = !adj || adj.importedBy.length === 0;
            const hasImports = adj && adj.imports.length > 0;

            // Named entry points always qualify
            // Files with no importers only qualify if they import something
            // (prevents orphan/unused files from being flagged)
            if (isNamed || (hasNoImporters && hasImports)) {
                entryPoints.push(node.id);
            }
        });

        // 2. BFS from entry points following the import chain
        const visited = new Set();
        const queue = [...entryPoints];
        while (queue.length > 0) {
            const nodeId = queue.shift();
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);
            critical.add(nodeId);

            const adj = adjacency[nodeId];
            if (adj) {
                adj.imports.forEach(dep => {
                    if (!visited.has(dep) && !supplementaryPatterns.some(p => p.test(dep))) {
                        queue.push(dep);
                    }
                });
            }
        }

        // 3. High-centrality nodes (only among SOURCE files)
        const centrality = sourceNodes
            .filter(n => !supplementaryPatterns.some(p => p.test(n.id)))
            .map(n => ({ id: n.id, score: adjacency[n.id]?.importedBy?.length || 0 }))
            .filter(c => c.score > 0) // Must be imported by at least 1 file
            .sort((a, b) => b.score - a.score);
        const topN = Math.max(3, Math.ceil(sourceNodes.length * 0.05)); // top 5% or at least 3
        const centralNodes = centrality.slice(0, topN).map(c => c.id);
        centralNodes.forEach(id => critical.add(id));

        // 4. Directories are NEVER hidden - they're structural navigation
        // (users need folders to expand and explore the codebase)
        nodes.forEach(n => {
            if (n.type === 'folder') {
                critical.add(n.id);
            }
        });

        // 5. Apply filter
        const isEntrySet = new Set(entryPoints);
        const isCentralSet = new Set(centralNodes);

        const getCriticalReason = (id) => {
            if (isEntrySet.has(id)) return 'Entry Point';
            if (isCentralSet.has(id)) return 'Core Module';
            if (nodes.find(n => n.id === id)?.type === 'folder') return null;
            return 'Execution Path';
        };

        // Stats only count source files (not folders or non-code)
        const criticalSourceCount = [...critical].filter(id => sourceNodes.some(n => n.id === id)).length;

        set({
            organizeMode: 'critical',
            organizeStats: {
                total: sourceNodes.length,
                critical: criticalSourceCount,
                hidden: sourceNodes.length - criticalSourceCount,
                entryPoints: entryPoints.length,
                centralNodes: centralNodes.length
            },
            nodes: nodes.map(n => ({
                ...n,
                // Never hide folders; only hide non-critical file nodes
                hidden: n.type === 'folder' ? false : !critical.has(n.id),
                data: {
                    ...n.data,
                    isEntryPoint: isEntrySet.has(n.id),
                    isCentral: isCentralSet.has(n.id),
                    criticalReason: critical.has(n.id) ? getCriticalReason(n.id) : null
                }
            })),
            edges: edges.map(e => ({
                ...e,
                hidden: !(critical.has(e.source) && critical.has(e.target))
            }))
        });
    },

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
        const updatedNodes = applyNodeChanges(changes, get().nodes);

        // Check if any position changes move a child outside its parent
        const hasDrag = changes.some(c => c.type === 'position' && c.dragging);

        if (hasDrag) {
            const edges = get().edges;
            const nodeMap = new Map(updatedNodes.map(n => [n.id, n]));
            let edgesChanged = false;

            const updatedEdges = edges.map(edge => {
                if (!edge.id.startsWith('contain-')) return edge;

                // Find the child node (target) and parent node (source)
                const childNode = nodeMap.get(edge.target);
                const parentNode = nodeMap.get(edge.source);

                if (!childNode || !parentNode) return edge;

                // Check if child is outside parent bounds
                const parentW = parentNode.style?.width || parentNode.data?.width || 300;
                const parentH = parentNode.style?.height || parentNode.data?.height || 200;
                const cx = childNode.position.x;
                const cy = childNode.position.y;

                const isOutside = cx < -20 || cy < -20 ||
                    cx > parentW - 50 || cy > parentH - 30;

                const targetOpacity = isOutside ? 0.7 : 0;
                const currentOpacity = edge.style?.opacity ?? 0;

                if (currentOpacity !== targetOpacity) {
                    edgesChanged = true;
                    return {
                        ...edge,
                        style: {
                            ...edge.style,
                            opacity: targetOpacity,
                            stroke: isOutside ? '#38bdf8' : '#475569',
                            strokeWidth: isOutside ? 1.5 : 1
                        }
                    };
                }
                return edge;
            });

            if (edgesChanged) {
                set({ nodes: updatedNodes, edges: updatedEdges });
            } else {
                set({ nodes: updatedNodes });
            }
        } else {
            set({ nodes: updatedNodes });
        }
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
                        : edge.id.startsWith('contain-')
                            ? { ...edge.style } // Preserve current containment visibility
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
