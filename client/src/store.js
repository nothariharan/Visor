import { create } from 'zustand';
import axios from 'axios';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';

const useStore = create((set, get) => ({
    nodes: [],
    edges: [],
    viewport: null,
    adjacency: {},
    loading: true, // Start in loading state
    error: null,
    expandedFolders: new Set(),
    focusedNode: null,
    organizeMode: 'all',
    organizeStats: null,
    editingFile: null,
    isSaving: false,
    activeRunDir: null,
    activeErrors: {},
    selectedPath: 'Visor',
    searchQuery: '',
    lastSaveTime: null,
    isSavingLayout: false,
    // Guard fields to avoid duplicate/rapid consecutive saves
    lastLayoutHash: null,
    lastSaveAttemptAt: null,
    isSearchModalOpen: false,

    // --- Layout Persistence ---
    loadLayout: async () => {
        console.log('[Visor] Attempting to load layout...');
        try {
            const res = await axios.get('/api/visor/load-layout');
            console.log('[Visor] Load response received:', res.data);

            if (res.data.exists && res.data.data) {
                const { nodes, edges, viewport, expandedFolders, organizeMode } = res.data.data;
                if (nodes && Array.isArray(nodes)) {
                    set({
                        nodes,
                        edges: edges || [],
                        viewport: viewport || null,
                        expandedFolders: new Set(expandedFolders || []),
                        organizeMode: organizeMode || 'all',
                        lastSaveTime: res.data.savedAt || null
                    });
                    console.log('✅ Layout loaded from .visor/layout.json');
                    // fetchGraph(true) will still perform the 0.7s delay internally
                    await get().fetchGraph(true);
                    return;
                }
            }
            console.log('No valid saved layout found. Performing initial graph analysis.');
            await get().fetchGraph();

        } catch (error) {
            console.error('❌ Failed to load layout:', error);
            set({ error: 'Could not load saved layout.' });
            await get().fetchGraph();
        }
    },

    saveLayout: async () => {
        const { nodes, edges, viewport, expandedFolders, organizeMode, isSavingLayout, lastLayoutHash, lastSaveAttemptAt } = get();
        if (nodes.length === 0) return;

        // Compute a small deterministic fingerprint for this layout to detect duplicates
        const layoutFingerprint = JSON.stringify({
            nodes: nodes.map(n => ({ id: n.id, position: n.position })),
            viewport,
            expandedFolders: Array.from(expandedFolders),
            organizeMode
        });

        const now = Date.now();
        const SKIP_MS = 3000; // if an identical layout was attempted within SKIP_MS, skip

        // If a save is already in progress, skip initiating another
        if (isSavingLayout) {
            console.log('[Visor] Skipping save: already saving');
            return;
        }

        // If fingerprint unchanged and last attempt was recent, skip duplicate save
        if (lastLayoutHash === layoutFingerprint && lastSaveAttemptAt && (now - lastSaveAttemptAt) < SKIP_MS) {
            console.log('[Visor] Skipping save: layout unchanged (debounced guard)');
            return;
        }

        // Record attempt and mark saving
        set({ isSavingLayout: true, lastLayoutHash: layoutFingerprint, lastSaveAttemptAt: now });
        console.log('[Visor] Triggering layout save...');

        const layoutData = {
            nodes: nodes.map(n => ({ id: n.id, position: n.position, width: n.width, height: n.height, parentNode: n.parentNode })),
            edges,
            viewport,
            expandedFolders: Array.from(expandedFolders),
            organizeMode
        };

        try {
            const res = await axios.post('/api/visor/save-layout', layoutData);
            console.log('[Visor] Save response received:', res.data);
            set({ lastSaveTime: res.data.savedAt, isSavingLayout: false });
        } catch (error) {
            console.error('❌ Failed to save layout:', error);
            set({ isSavingLayout: false });
        }
    },

    setViewport: (viewport) => set({ viewport }),

    // --- Original Actions ---
    setActiveRunDir: (dir) => set({ activeRunDir: dir }),
    setSelectedPath: (path) => set({ selectedPath: path }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setIsSearchModalOpen: (isOpen) => set({ isSearchModalOpen: isOpen }),

    handleExecutionError: (errorData) => {
        const { executionPath, primaryFile, error } = errorData;
        const normalize = (p) => p ? p.replace(/\\/g, '/').toLowerCase() : '';

        const normalizedPrimary = normalize(primaryFile);
        const newErrors = { ...get().activeErrors };

        if (normalizedPrimary) {
            newErrors[normalizedPrimary] = {
                message: error.message,
                line: error.stack?.[0]?.line,
                timestamp: Date.now(),
                type: 'error'
            };
        }

        const implicatedNodeIds = new Set();
        const nodes = get().nodes;

        const findGraphNodeId = (searchPath) => {
            const searchNorm = normalize(searchPath);
            const match = nodes.find(n => normalize(n.id) === searchNorm);
            return match ? match.id : null;
        };

        executionPath.forEach(frame => {
            const fileNodeId = findGraphNodeId(frame.file);
            if (fileNodeId) {
                implicatedNodeIds.add(fileNodeId);
                const parts = normalize(fileNodeId).split('/');
                parts.pop();
                while (parts.length > 0) {
                    const folderPath = parts.join('/');
                    const folderNodeId = findGraphNodeId(folderPath);
                    if (folderNodeId) implicatedNodeIds.add(folderNodeId);
                    parts.pop();
                }
            }
        });

        get().highlightExecutionPath(Array.from(implicatedNodeIds), 'error');
        set({ activeErrors: newErrors });
    },

    clearErrors: () => {
        set({ activeErrors: {} });
        get().clearExecutionPath();
    },

    organizeGraph: (mode) => {
        const { nodes, edges, adjacency } = get();

        if (mode === 'all') {
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

        const critical = new Set();
        const SOURCE_EXTENSIONS = /\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte)$/i;
        const NON_CRITICAL_PATTERNS = [
            /\.(txt|md|log|csv|yml|yaml|toml|xml|lock)$/i,
            /\.(json)$/i,
            /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|mp4|mp3)$/i,
            /\.(css|scss|sass|less|styl)$/i,
            /\.(env|env\..*)$/i,
            /\.config\.(js|ts|mjs|cjs)$/i,
            /visor\.config/i,
            /package(-lock)?\.json$/i,
            /tsconfig.*\.json$/i,
            /\.eslintrc/i, /\.prettierrc/i, /\.babelrc/i,
            /webpack\.config/i, /rollup\.config/i,
        ];

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
            /debug\.(js|ts)$/i,
        ];

        const isSourceCode = (id) => SOURCE_EXTENSIONS.test(id) && !NON_CRITICAL_PATTERNS.some(p => p.test(id));

        const entryPoints = [];
        const fileNodes = nodes.filter(n => n.type === 'custom');
        const sourceNodes = fileNodes.filter(n => isSourceCode(n.id));

        sourceNodes.forEach(node => {
            if (supplementaryPatterns.some(p => p.test(node.id))) return;
            const isNamed = entryPatterns.some(p => p.test(node.id));
            const adj = adjacency[node.id];
            const hasNoImporters = !adj || adj.importedBy.length === 0;
            const hasImports = adj && adj.imports.length > 0;
            if (isNamed || (hasNoImporters && hasImports)) {
                entryPoints.push(node.id);
            }
        });

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

        nodes.forEach(n => {
            if (n.type === 'folder') critical.add(n.id);
        });

        const isEntrySet = new Set(entryPoints);
        const getCriticalReason = (id) => {
            if (isEntrySet.has(id)) return 'Entry Point';
            if (nodes.find(n => n.id === id)?.type === 'folder') return null;
            return 'Execution Path';
        };

        const criticalSourceCount = [...critical].filter(id => sourceNodes.some(n => n.id === id)).length;

        set({
            organizeMode: 'critical',
            organizeStats: {
                total: sourceNodes.length,
                critical: criticalSourceCount,
                hidden: sourceNodes.length - criticalSourceCount,
                entryPoints: entryPoints.length,
                centralNodes: 0
            },
            nodes: nodes.map(n => ({
                ...n,
                hidden: n.type === 'folder' ? false : !critical.has(n.id),
                data: {
                    ...n.data,
                    isEntryPoint: isEntrySet.has(n.id),
                    criticalReason: critical.has(n.id) ? getCriticalReason(n.id) : null
                }
            })),
            edges: edges.map(e => ({
                ...e,
                hidden: !(critical.has(e.source) && critical.has(e.target))
            }))
        });
    },

    toggleFolder: (folderId) => {
        const { expandedFolders, fetchGraph } = get();
        const newSet = new Set(expandedFolders);
        if (newSet.has(folderId)) {
            newSet.delete(folderId);
        } else {
            newSet.add(folderId);
        }
        set({ expandedFolders: newSet });
        set({ selectedPath: folderId.split('/').pop() || 'Visor' });
        fetchGraph(false, folderId);
    },

    expandPaths: (paths) => {
        const { expandedFolders, fetchGraph } = get();
        const newSet = new Set(expandedFolders);
        paths.forEach(p => newSet.add(p));
        set({ expandedFolders: newSet });
        fetchGraph();
    },

    setFocusedNode: (nodeId) => {
        // ... (rest of the function is unchanged)
    },

    openFile: async (path, label) => {
        // ... (rest of the function is unchanged)
    },

    setEditingFile: (file) => set({ editingFile: file }),
    closeFile: () => set({ editingFile: null }),

    resetLayout: async () => {
        try {
            // Call backend to delete saved layout
            await axios.post('/api/visor/reset-layout');

            // Reset local state
            set({
                nodes: [],
                edges: [],
                viewport: null,
                expandedFolders: new Set(),
                organizeMode: 'all',
                loading: true
            });

            // Fetch fresh graph with no saved positions
            await get().fetchGraph();

            console.log('✅ Layout reset to default');
        } catch (error) {
            console.error('❌ Failed to reset layout:', error);
        }
    },
    updateFileContent: (newContent) => {
        const current = get().editingFile;
        if (current) {
            set({ editingFile: { ...current, content: newContent } });
        }
    },
    saveFile: async () => {
        // ... (rest of the function is unchanged)
    },

    fetchGraph: async (isBackground = false, anchorNodeId = null) => {
        if (!isBackground && !anchorNodeId) {
            set({ loading: true, error: null });
        }
        const startTime = Date.now();
        try {
            const { expandedFolders, nodes: currentNodes } = get();
            const res = await axios.post('/api/graph', { expandedFolders: Array.from(expandedFolders) });
            const incomingNodes = res.data.nodes || [];

            const positionMap = new Map(currentNodes.map(n => [n.id, { pos: n.position, w: n.width, h: n.height }]));

            const mergedNodes = incomingNodes.map(newNode => {
                const existing = positionMap.get(newNode.id);
                if (existing) {
                    return { ...newNode, position: existing.pos, width: existing.w, height: existing.h };
                }
                return newNode;
            });

            const edgesWithStyle = (res.data.edges || []).map(e => {
                const edgeObj = { ...e, type: 'custom' };
                if (e.id.startsWith('hierarchy-')) {
                    return { ...edgeObj, style: { stroke: '#38bdf8', strokeWidth: 2.5, opacity: 1, strokeDasharray: '8,4' } };
                }
                return { ...edgeObj, style: { ...e.style, opacity: 0.6 } };
            });

            // Ensure at least 1000ms loading time
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 1000 - elapsed);

            setTimeout(() => {
                set({
                    nodes: mergedNodes,
                    edges: edgesWithStyle,
                    adjacency: res.data.adjacency || {},
                    loading: false,
                    focusedNode: isBackground ? get().focusedNode : null
                });

                if (get().organizeMode === 'critical') {
                    get().organizeGraph('critical');
                }
            }, remaining);

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

    onConnect: (connection) => {
        set({
            edges: addEdge({ ...connection, type: 'custom', animated: true, data: { isManual: true } }, get().edges),
        });
    },

    highlightDependencies: (nodeId) => {
        // ... (rest of the function is unchanged)
    },

    highlightExecutionPath: (nodeIds, type) => {
        // ... (rest of the function is unchanged)
    },

    clearExecutionPath: () => {
        const { edges } = get();
        set({
            edges: edges.map(edge => {
                if (edge.data?.executionType) {
                    // Restore original style
                    const isHierarchy = edge.id.startsWith('hierarchy-');
                    return {
                        ...edge,
                        animated: false,
                        style: isHierarchy
                            ? { stroke: '#38bdf8', strokeWidth: 2.5, opacity: 1, strokeDasharray: '8,4' }
                            : { ...edge.style, stroke: edge.style?.stroke || '#94a3b8', strokeWidth: 1, opacity: 0.6, strokeDasharray: undefined },
                        data: { ...edge.data, executionType: null }
                    };
                }
                return edge;
            })
        });
    },

    // ===== Chronicle Git Actions =====
    chronicleStatus: null,
    chronicleLoading: false,
    stagingFiles: new Set(),
    pushPullLoading: false,
    commitLoading: false,
    chronicleError: null,

    fetchChronicleStatus: async () => {
        set({ chronicleLoading: true, chronicleError: null });
        try {
            const res = await axios.get('/api/chronicle/status');
            if (res.data.success) {
                set({ chronicleStatus: res.data, chronicleError: null });
            } else {
                set({ chronicleError: { message: res.data.error, type: res.data.type } });
            }
        } catch (err) {
            set({ chronicleError: { message: 'Failed to fetch git status', type: 'FETCH_ERROR' } });
        } finally {
            set({ chronicleLoading: false });
        }
    },

    stageFiles: async (files) => {
        const currentStaging = new Set(get().stagingFiles);
        files.forEach(f => currentStaging.add(f));
        set({ stagingFiles: currentStaging });

        try {
            const res = await axios.post('/api/chronicle/stage', { files });
            if (!res.data.success) {
                set({ chronicleError: { message: res.data.error, type: res.data.type } });
            }
            // Auto-refresh via socket will happen, but let's be proactive
            await get().fetchChronicleStatus();
        } finally {
            const nextStaging = new Set(get().stagingFiles);
            files.forEach(f => nextStaging.delete(f));
            set({ stagingFiles: nextStaging });
        }
    },

    unstageFiles: async (files) => {
        const currentStaging = new Set(get().stagingFiles);
        files.forEach(f => currentStaging.add(f));
        set({ stagingFiles: currentStaging });

        try {
            const res = await axios.post('/api/chronicle/unstage', { files });
            if (!res.data.success) {
                set({ chronicleError: { message: res.data.error, type: res.data.type } });
            }
            await get().fetchChronicleStatus();
        } finally {
            const nextStaging = new Set(get().stagingFiles);
            files.forEach(f => nextStaging.delete(f));
            set({ stagingFiles: nextStaging });
        }
    },

    commitChanges: async (message) => {
        set({ commitLoading: true, chronicleError: null });
        try {
            const res = await axios.post('/api/chronicle/commit', { message });
            if (res.data.success) {
                await get().fetchChronicleStatus();
                return { success: true };
            } else {
                set({ chronicleError: { message: res.data.error, type: res.data.type } });
                return { success: false };
            }
        } finally {
            set({ commitLoading: false });
        }
    },

    discardFiles: async (files) => {
        try {
            const res = await axios.post('/api/chronicle/discard', { files });
            if (res.data.success) {
                await get().fetchChronicleStatus();
            } else {
                set({ chronicleError: { message: res.data.error, type: res.data.type } });
            }
        } catch (err) {
            set({ chronicleError: { message: 'Failed to discard changes', type: 'DISCARD_ERROR' } });
        }
    },

    pushChanges: async () => {
        set({ pushPullLoading: true, chronicleError: null });
        try {
            const res = await axios.post('/api/chronicle/push');
            if (res.data.success) {
                await get().fetchChronicleStatus();
            } else {
                set({ chronicleError: { message: res.data.error, type: res.data.type } });
            }
        } finally {
            set({ pushPullLoading: false });
        }
    },

    pullChanges: async () => {
        set({ pushPullLoading: true, chronicleError: null });
        try {
            const res = await axios.post('/api/chronicle/pull');
            if (res.data.success) {
                await get().fetchChronicleStatus();
                return { success: true };
            } else {
                // If merge conflict, result still might be useful to the UI
                set({ chronicleError: { message: res.data.error, type: res.data.type } });
                await get().fetchChronicleStatus();
                return res.data;
            }
        } finally {
            set({ pushPullLoading: false });
        }
    },

    undoLastCommit: async () => {
        try {
            const res = await axios.post('/api/chronicle/undo');
            if (res.data.success) {
                await get().fetchChronicleStatus();
            } else {
                set({ chronicleError: { message: res.data.error, type: res.data.type } });
            }
        } catch (err) {
            set({ chronicleError: { message: 'Failed to undo commit', type: 'UNDO_ERROR' } });
        }
    },

    clearChronicleError: () => set({ chronicleError: null })
}));

useStore.getState().loadLayout();

export default useStore;
