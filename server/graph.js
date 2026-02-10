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

        // 3. Dependencies
        let cruiseModules = [];
        try {
            const { cruise } = await import("dependency-cruiser");
            const cruiseResult = await cruise([rootDir], {
                exclude: `(node_modules|dist|build|coverage|test|spec)`,
                maxDepth: 4,
                outputType: "json"
            });

            if (cruiseResult.output && cruiseResult.output.modules) {
                cruiseModules = cruiseResult.output.modules;
            }
        } catch (e) { console.warn("Dep cruise failed", e); }

        // Find Visible Node Helper
        const sortedNodes = [...nodes].sort((a, b) => b.id.length - a.id.length);
        const findVisibleNode = (filePath) => {
            const normalizedFile = path.resolve(filePath);
            for (const node of sortedNodes) {
                if (node.type === 'custom' && node.id === normalizedFile) return node;
                if (node.type === 'folder' && normalizedFile.startsWith(node.id)) return node;
            }
            return null;
        };

        // Aggregate Edges
        const edgeSet = new Set();
        cruiseModules.forEach(mod => {
            const sourceNode = findVisibleNode(mod.source);
            if (!sourceNode) return;
            if (mod.dependencies) {
                mod.dependencies.forEach(dep => {
                    const targetNode = findVisibleNode(dep.resolved);
                    if (!targetNode) return;
                    if (sourceNode.id !== targetNode.id) {
                        const edgeId = `${sourceNode.id}-${targetNode.id}`;
                        if (!edgeSet.has(edgeId)) {
                            edgeSet.add(edgeId);
                            edges.push({ id: edgeId, source: sourceNode.id, target: targetNode.id });
                        }
                    }
                });
            }
        });

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
                    "elk.padding": "[top=60,left=30,bottom=30,right=30]",
                    "elk.algorithm": "force", // Force inside folders for square-like arrangement
                    "elk.force.iterations": "150",
                    "elk.spacing.nodeNode": "60",
                    "org.eclipse.elk.force.repulsion": "2.0"
                } : undefined

            });
        });

        const rootChildren = [];

        // Populate hierarchy
        nodes.forEach(n => {
            const parentDir = path.dirname(n.id);
            const parentNode = nodeMap.get(parentDir);
            const elkNode = nodeMap.get(n.id);

            // If we have a visible parent (expanded folder), add as child
            if (parentNode && foldersToScan.has(parentDir)) {
                parentNode.children.push(elkNode);
            } else {
                // Top level visible node (or orphan)
                rootChildren.push(elkNode);
            }
        });

        // Add edges to graph. in ELK hierarchical, edges can reference any node id
        const elkEdges = edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }));

        // 5. Run ELK Layout
        const rootGraph = {
            id: "root",
            layoutOptions: {
                "elk.algorithm": "force",
                "elk.hierarchyHandling": "INCLUDE_CHILDREN",
                "elk.force.iterations": "300",
                "elk.spacing.nodeNode": "100",
                "org.eclipse.elk.force.repulsion": "4.0",
                "elk.randomSeed": "123456", // Ensure deterministic layout
                "elk.force.model": "EADES",
                "elk.aspectRatio": "2.0", // Encourage horizontal spread
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
            if (originalNode) {
                positionedNodes.push({
                    ...originalNode,
                    position: { x: elkNode.x, y: elkNode.y },
                    style: { width: elkNode.width, height: elkNode.height }, // ELK calculates size for containers!
                    parentNode: parentId, // React Flow Parent
                    extent: parentId ? 'parent' : undefined,
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
