const ELK = require("elkjs");

const path = require("path");
const fs = require("fs-extra");
const { getGitMetadata } = require("./git");
const elk = new ELK();

const MAX_FILES_DEFAULT = 2000;


async function generateGraph(rootDir, expandedFolders = [], options = {}) {
    const MAX_FILES = options.maxFiles || MAX_FILES_DEFAULT;
    const ignorePatterns = options.ignore || [];

    try {
        let nodes = [];
        let edges = [];
        const visibleItems = new Set();
        const filesToScan = [];

        // Always include rootDir contents
        const foldersToScan = new Set(expandedFolders);
        foldersToScan.add(rootDir);

        // 1. Scan Directories to find visible nodes
        for (const folderPath of foldersToScan) {
            if (!fs.existsSync(folderPath)) continue;

            try {
                const dirents = await fs.readdir(folderPath, { withFileTypes: true });
                for (const dirent of dirents) {
                    if (dirent.name.startsWith('.') || dirent.name === 'node_modules' || dirent.name === 'dist' || dirent.name === 'build') continue;
                    if (ignorePatterns.some(p => dirent.name.includes(p.replace(/\*/g, '')))) continue;

                    const fullPath = path.resolve(folderPath, dirent.name);

                    // Prevent duplicates in visibleItems
                    if (visibleItems.has(fullPath)) continue;
                    visibleItems.add(fullPath);

                    const isDirectory = dirent.isDirectory();
                    nodes.push({
                        id: fullPath,
                        data: { label: dirent.name, path: fullPath, type: isDirectory ? 'folder' : 'file', expanded: foldersToScan.has(fullPath) },
                        type: isDirectory ? 'folder' : 'custom',
                        // Initialize dimensions
                        width: isDirectory ? 300 : 200,
                        height: isDirectory ? 200 : 60
                    });

                    if (!isDirectory) filesToScan.push(fullPath);
                }
            } catch (err) {
                console.warn(`Failed to read dir ${folderPath}:`, err);
            }
        }

        // 2. Git Metadata
        await Promise.all(nodes.map(async (node) => {
            if (node.type === 'custom') {
                try {
                    const gitData = await getGitMetadata(node.id);
                    node.data.git = gitData;
                } catch (e) { }
            }
        }));

        // 3. Dependencies - Enhanced with color-coded edges
        // Edge color scheme by dependency type
        const EDGE_COLORS = {
            css: { stroke: '#38bdf8', label: 'CSS' },        // Sky blue
            component: { stroke: '#34d399', label: 'Component' },  // Emerald
            module: { stroke: '#fbbf24', label: 'Module' },     // Amber
            utility: { stroke: '#a78bfa', label: 'Utility' },    // Violet
            data: { stroke: '#fb923c', label: 'Data' },       // Orange
            image: { stroke: '#f472b6', label: 'Asset' },      // Pink
            dynamic: { stroke: '#c084fc', label: 'Dynamic' },    // Purple
            circular: { stroke: '#ef4444', label: 'Circular!' },  // Red
            default: { stroke: '#94a3b8', label: '' }            // Slate
        };

        // Classify a dependency by its module path
        const classifyDep = (modulePath, depObj) => {
            if (!modulePath) return 'default';
            // Circular
            if (depObj && depObj.circular) return 'circular';
            // Dynamic import
            if (depObj && depObj.dynamic) return 'dynamic';
            // CSS/Style
            if (/\.(css|scss|sass|less|styl)$/i.test(modulePath)) return 'css';
            // Images/Assets
            if (/\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i.test(modulePath)) return 'image';
            // Data files
            if (/\.(json|yaml|yml|toml|xml|csv)$/i.test(modulePath)) return 'data';
            // React/Vue components (JSX/TSX or PascalCase)
            if (/\.(jsx|tsx|vue)$/i.test(modulePath)) return 'component';
            const basename = path.basename(modulePath).replace(/\.[^.]+$/, '');
            if (/^[A-Z]/.test(basename)) return 'component';
            // Utilities
            if (/(util|helper|lib|service|hook|context|middleware|config)/i.test(modulePath)) return 'utility';
            return 'module';
        };

        // Build a styled edge object
        const createStyledEdge = (sourceId, targetId, depType, depObj) => {
            const color = EDGE_COLORS[depType] || EDGE_COLORS.default;
            const isDynamic = depType === 'dynamic';
            const isCircular = depType === 'circular';
            return {
                id: `dep-${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                type: 'default',
                data: { depType, label: color.label },
                style: {
                    stroke: color.stroke,
                    strokeWidth: isCircular ? 3 : 2,
                    strokeDasharray: isDynamic ? '5,5' : isCircular ? '3,3' : undefined,
                },
                markerEnd: {
                    type: 'arrowclosed',
                    color: color.stroke,
                    width: 16,
                    height: 16
                },
                animated: isDynamic
            };
        };

        // --- dependency-cruiser integration ---
        let cruiseModules = [];
        try {
            const { cruise } = await import("dependency-cruiser");
            const cruiseResult = await cruise([rootDir], {
                exclude: `(node_modules|dist|build|coverage|test|spec|\\.git)`,
                maxDepth: 4,
                outputType: "json"
            });

            if (cruiseResult.output && cruiseResult.output.modules) {
                cruiseModules = cruiseResult.output.modules;
            }
        } catch (e) { console.warn("Dep cruise failed, using fallback parser", e.message); }

        // --- Fallback: lightweight import parser for files cruise missed ---
        const IMPORT_REGEX = /(?:import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

        const parseFallbackImports = async (filePath) => {
            const deps = [];
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                let match;
                while ((match = IMPORT_REGEX.exec(content)) !== null) {
                    const mod = match[1] || match[2];
                    if (mod && mod.startsWith('.')) {
                        // Resolve relative path
                        const dir = path.dirname(filePath);
                        const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json', '.css'];
                        for (const ext of extensions) {
                            const resolved = path.resolve(dir, mod + ext);
                            if (fs.existsSync(resolved)) {
                                deps.push({ module: mod, resolved, depType: classifyDep(mod, null) });
                                break;
                            }
                        }
                    }
                }
            } catch (e) { /* skip unreadable files */ }
            return deps;
        };

        // Find Visible Node Helper
        const sortedNodes = [...nodes].sort((a, b) => b.id.length - a.id.length);
        const findVisibleNode = (filePath) => {
            const normalizedFile = path.resolve(filePath);
            for (const node of sortedNodes) {
                if (node.type === 'custom' && node.id === normalizedFile) return node;
                // Strict path check to avoid partial name matching (e.g. server -> server_log.txt)
                if (node.type === 'folder' && (normalizedFile.startsWith(node.id + path.sep))) return node;
            }
            return null;
        };

        // Aggregate Edges (with classification)
        const edgeSet = new Set();

        // From dependency-cruiser results
        cruiseModules.forEach(mod => {
            const sourceNode = findVisibleNode(mod.source);
            if (!sourceNode) return;
            if (mod.dependencies) {
                mod.dependencies.forEach(dep => {
                    const targetNode = findVisibleNode(dep.resolved);
                    if (!targetNode) return;
                    if (sourceNode.id !== targetNode.id) {
                        const edgeKey = `${sourceNode.id}→${targetNode.id}`;
                        if (!edgeSet.has(edgeKey)) {
                            edgeSet.add(edgeKey);
                            const depType = classifyDep(dep.module || dep.resolved, dep);
                            edges.push(createStyledEdge(sourceNode.id, targetNode.id, depType, dep));
                        }
                    }
                });
            }
        });

        // Fallback for files not covered by cruise
        const cruisedFiles = new Set(cruiseModules.map(m => path.resolve(m.source)));
        await Promise.all(filesToScan.map(async (filePath) => {
            if (cruisedFiles.has(filePath)) return; // Already handled
            const deps = await parseFallbackImports(filePath);
            const sourceNode = findVisibleNode(filePath);
            if (!sourceNode) return;

            for (const dep of deps) {
                const targetNode = findVisibleNode(dep.resolved);
                if (!targetNode || sourceNode.id === targetNode.id) continue;
                const edgeKey = `${sourceNode.id}→${targetNode.id}`;
                if (!edgeSet.has(edgeKey)) {
                    edgeSet.add(edgeKey);
                    edges.push(createStyledEdge(sourceNode.id, targetNode.id, dep.depType, null));
                }
            }
        }));

        // 4. Build Hierarchy for ELK
        // Map nodes to Objects with children
        const nodeMap = new Map();
        nodes.forEach(n => {
            nodeMap.set(n.id, {
                id: n.id,
                width: n.type === 'custom' ? 220 : 150, // Initial size, folders will grow 
                height: n.type === 'custom' ? 80 : 80,
                children: [],
                layoutOptions: n.type === 'folder' ? {
                    "elk.padding": "[top=80,left=35,bottom=35,right=35]",
                    "elk.algorithm": "box",
                    "elk.spacing.nodeNode": "45",
                    "elk.box.packingMode": "GROUP_DEC",
                    "elk.aspectRatio": "2.5" // Wide rectangle, not vertical column
                } : undefined

            });
        });

        const rootChildren = [];
        const processedNodes = new Set(); // Track nodes added to hierarchy

        // Populate hierarchy
        nodes.forEach(n => {
            if (processedNodes.has(n.id)) return; // Skip if already processed (though nodes should be unique now)

            const parentDir = path.dirname(n.id);
            const parentNode = nodeMap.get(parentDir);
            const elkNode = nodeMap.get(n.id);

            // If we have a visible parent (expanded folder)
            if (parentNode && foldersToScan.has(parentDir)) {
                if (n.type === 'folder') {
                    // Detach sub-folder -> Root Level + Connection Line
                    rootChildren.push(elkNode);
                    processedNodes.add(n.id);

                    // Add hierarchy edge
                    const edgeId = `hierarchy-${parentNode.id}-${n.id}`;
                    if (!edgeSet.has(edgeId)) {
                        edgeSet.add(edgeId);
                        edges.push({
                            id: edgeId,
                            source: parentNode.id,
                            target: n.id,
                            type: 'smoothstep', // Distinct style for hierarchy?
                            style: { stroke: '#64748b', strokeDasharray: '5,5' }, // Dashed line
                            animated: false
                        });
                    }
                } else {
                    // Keep file inside container
                    parentNode.children.push(elkNode);
                    processedNodes.add(n.id);

                    // Add containment edge (visible when file is dragged outside)
                    const containEdgeId = `contain-${parentDir}-${n.id}`;
                    if (!edgeSet.has(containEdgeId)) {
                        edgeSet.add(containEdgeId);
                        edges.push({
                            id: containEdgeId,
                            source: parentDir,
                            target: n.id,
                            type: 'smoothstep',
                            style: { stroke: '#475569', strokeWidth: 1, strokeDasharray: '4,4', opacity: 0 },
                            animated: false,
                            data: { depType: 'containment' }
                        });
                    }
                }
            } else {
                // Top level visible node (or orphan)
                rootChildren.push(elkNode);
                processedNodes.add(n.id);
            }
        });


        // Add edges to graph. in ELK hierarchical, edges can reference any node id
        const elkEdges = edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }));

        // 5. Run ELK Layout
        const rootGraph = {
            id: "root",
            layoutOptions: {
                "elk.algorithm": "box", // Packs nodes into horizontal rows
                "elk.hierarchyHandling": "INCLUDE_CHILDREN",
                "elk.spacing.nodeNode": "60",
                "elk.box.packingMode": "GROUP_DEC", // Pack largest first
                "elk.aspectRatio": "2.5", // Wide rectangle
            },
            children: rootChildren,
            edges: elkEdges
        };

        const layout = await elk.layout(rootGraph);

        // 6. Flatten Result & Assign ParentNode
        const positionedNodes = [];

        function traverseAndFlatten(elkNode, parentId = null) {
            // Find original node data
            const originalNode = nodes.find(n => n.id === elkNode.id);

            // Re-calculate the actual parent directory for FileTree hierarchy
            // (Even if ELK detached it for layout purposes, we want the logical hierarchy)
            let actualParentId = parentId;
            if (!actualParentId && originalNode) {
                const parentDir = path.dirname(originalNode.id);
                // Ensure the parent directory is not the same as the node and is in the folders list
                if (foldersToScan.has(parentDir) && parentDir !== originalNode.id) {
                    // CRITICAL FIX: Only assign if the parentDir itself is a node in the graph
                    // This prevents React Flow 'Parent node not found' errors when rootDir is assigned as parent
                    if (nodes.some(n => n.id === parentDir)) {
                        actualParentId = parentDir;
                    }
                }
            }

            if (originalNode) {
                positionedNodes.push({
                    ...originalNode,
                    position: { x: elkNode.x, y: elkNode.y },
                    style: { width: elkNode.width, height: elkNode.height },
                    parentNode: actualParentId, // Logic hierarchy for React Flow and FileTree
                    extent: undefined,
                    data: { ...originalNode.data, width: elkNode.width, height: elkNode.height }
                });
            }

            if (elkNode.children) {
                elkNode.children.forEach(child => traverseAndFlatten(child, elkNode.id));
            }
        }

        layout.children.forEach(child => traverseAndFlatten(child, null));

        // Build Adjacency (same as before)
        const adjacency = {};
        positionedNodes.forEach(n => { adjacency[n.id] = { imports: [], importedBy: [] }; });
        edges.forEach(e => {
            if (adjacency[e.source]) adjacency[e.source].imports.push(e.target);
            if (adjacency[e.target]) adjacency[e.target].importedBy.push(e.source);
        });

        // Health Score
        positionedNodes.forEach(node => {
            let score = 100;
            const adj = adjacency[node.id];
            // ... (simple health logic)
            if (adj && (adj.imports.length > 10 || adj.importedBy.length > 10)) score -= 10;
            if (node.data.git && node.data.git.commits > 20) score -= 20;
            node.data.health = Math.max(0, score);
        });

        // Note: Graph edges in React Flow are absolute paths. 
        // With parentNode, edges still work fine as long as IDs match.

        return { nodes: positionedNodes, edges, adjacency };

    } catch (error) {
        console.error("Graph generation failed:", error);
        throw error;
    }
}


// Simple in-memory cache for the *last* request if needed, but since request varies by expandedFolders, 
// a simple global cache might be wrong. We can rely on fast generation for simplified view.
// Or cache by visibleItems hash. For now, no cache for expanded view to ensure correctness.
function getCachedGraph() {
    return { nodes: [], edges: [], adjacency: {} };
}

module.exports = { generateGraph, getCachedGraph };
