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
                        loading: false,
                        lastSaveTime: res.data.savedAt || null
                    });
                    console.log('✅ Layout loaded from .visor/layout.json');
                    get().fetchGraph(true);
                    return;
                }
            }
            console.log('No valid saved layout found. Performing initial graph analysis.');
            await get().fetchGraph();

        } catch (error) {
            console.error('❌ Failed to load layout:', error);
            set({ error: 'Could not load saved layout.', loading: false });
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
        // ... (rest of the function is unchanged)
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

    closeFile: () => set({ editingFile: null }),
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
        // ... (rest of the function is unchanged)
    }
}));

useStore.getState().loadLayout();

export default useStore;
