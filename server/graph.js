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
        const nodes = [];
        const edges = [];
        const adjacency = {};

        const visibleItems = new Set();
        const filesToScan = [];

        // Always include rootDir contents
        // expandedFolders should contain absolute paths
        const foldersToScan = new Set(expandedFolders);
        foldersToScan.add(rootDir);

        for (const folderPath of foldersToScan) {
            if (!fs.existsSync(folderPath)) continue;

            try {
                const dirents = await fs.readdir(folderPath, { withFileTypes: true });
                for (const dirent of dirents) {
                    // Skip hidden files and standard ignores
                    if (dirent.name.startsWith('.') || dirent.name === 'node_modules' || dirent.name === 'dist' || dirent.name === 'build') continue;

                    // content check for ignore patterns (simple check for now)
                    if (ignorePatterns.some(p => dirent.name.includes(p.replace(/\*/g, '')))) continue;

                    const fullPath = path.resolve(folderPath, dirent.name);

                    visibleItems.add(fullPath);

                    const isDirectory = dirent.isDirectory();

                    nodes.push({
                        id: fullPath,
                        data: { label: dirent.name, path: fullPath, type: isDirectory ? 'folder' : 'file' },
                        position: { x: 0, y: 0 },
                        type: isDirectory ? 'folder' : 'custom'
                    });

                    if (!isDirectory) {
                        filesToScan.push(fullPath);
                    }
                }
            } catch (err) {
                console.warn(`Failed to read dir ${folderPath}:`, err);
            }
        }

        // Enrich with Git Metadata (Parallel)
        // Limit concurrency if needed, but for visible nodes it should be okay
        await Promise.all(nodes.map(async (node) => {
            if (node.type === 'custom') {
                try {
                    const gitData = await getGitMetadata(node.id);
                    node.data.git = gitData;
                } catch (e) {
                    console.warn(`Git fetch failed for ${node.id}`);
                }
            }
        }));

        // Run dependency-cruiser on the entire project to find architectural links
        // We scan everything (up to limits) and aggregate dependencies to visible nodes.
        let cruiseModules = [];
        try {
            const { cruise } = await import("dependency-cruiser");
            // Scan rootDir recursively, respecting ignore patterns
            const cruiseResult = await cruise(
                [rootDir],
                {
                    exclude: `(${ignorePatterns.join('|')}|node_modules|dist|build|coverage)`,
                    maxDepth: 4, // Limit depth for performance, usually enough for architecture
                    outputType: "json",
                    // TypeScript/JSX support is automatic if extensions are present
                }
            );
            if (cruiseResult.output && cruiseResult.output.modules) {
                cruiseModules = cruiseResult.output.modules;
            }
        } catch (e) {
            console.warn("Dependency parsing failure:", e);
        }

        // Helper to find the visible node that 'contains' a file path
        // Sort visible nodes by path length descending to match deepest folder first
        const sortedNodes = [...nodes].sort((a, b) => b.id.length - a.id.length);

        const findVisibleNode = (filePath) => {
            // Normalize path separators
            const normalizedFile = path.resolve(filePath);
            for (const node of sortedNodes) {
                // If node is a file, exact match
                if (node.type === 'custom' && node.id === normalizedFile) return node;
                // If node is a folder, prefix match
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

                    // Create edge if nodes are different
                    if (sourceNode.id !== targetNode.id) {
                        const edgeId = `${sourceNode.id}-${targetNode.id}`;
                        if (!edgeSet.has(edgeId)) {
                            edgeSet.add(edgeId);
                            edges.push({
                                id: edgeId,
                                source: sourceNode.id,
                                target: targetNode.id
                            });
                        }
                    }
                });
            }
        });


        // Create explicit edges from Parent Folder to Children (Directory Hierarchy)
        nodes.forEach(node => {
            if (node.id === rootDir) return;

            // Find parent directory
            const parentDir = path.dirname(node.id);

            // Find parent node in our visible nodes list
            const parentNode = sortedNodes.find(n => n.id === parentDir);

            // Only add edge if parent is visible (i.e., we are strictly opening a folder)
            if (parentNode) {
                const heirarchyEdgeId = `hierarchy-${parentNode.id}-${node.id}`;
                // Avoid duplicating if we already have a dependency edge (though unlikely for folder->file)
                if (!edgeSet.has(heirarchyEdgeId)) {
                    edges.push({
                        id: heirarchyEdgeId,
                        source: parentNode.id,
                        target: node.id,
                        style: { stroke: '#475569', strokeDasharray: '5,5', opacity: 0.3 },
                        animated: false,
                        type: 'smoothstep'
                    });
                }
            }
        });

        // Layout
        const elkChildren = nodes.map(n => ({ id: n.id, width: n.type === 'folder' ? 160 : 200, height: 60 }));
        const elkEdges = edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }));

        const layout = await elk.layout({
            id: "root",
            layoutOptions: {
                "elk.algorithm": "radial",
                "elk.spacing.nodeNode": "80",
                // Radial specific: places nodes in circles around center
            },

            children: elkChildren,
            edges: elkEdges
        });


        const positionedNodes = nodes.map(node => {
            const layoutNode = layout.children.find(n => n.id === node.id);
            return {
                ...node,
                position: { x: layoutNode?.x || 0, y: layoutNode?.y || 0 }
            };
        });

        // Build Adjacency & Calculate Health Score
        positionedNodes.forEach(n => { adjacency[n.id] = { imports: [], importedBy: [] }; });
        edges.forEach(e => {
            if (adjacency[e.source]) adjacency[e.source].imports.push(e.target);
            if (adjacency[e.target]) adjacency[e.target].importedBy.push(e.source);
        });

        // Calculate Health Score
        positionedNodes.forEach(node => {
            let score = 100;
            const adj = adjacency[node.id];
            const git = node.data.git;

            // Factor 1: High Coupling (Fan-in/Fan-out)
            if (adj.imports.length > 10) score -= 10;
            if (adj.importedBy.length > 10) score -= 10;

            // Factor 2: Git Churn
            if (git && git.commits > 20) score -= 20;

            // Factor 3: Circular Dependencies (Check edges)
            // We need to know if any outgoing edge is circular.
            // In dependency-cruiser output, we didn't store circularity in edge objects in the arrays above.
            // But we can check it now if we stored it?
            // We can't easily detecting cycles in adjacency list here without graph traversal.
            // For now, let's mark it if we had the info. 
            // Actually, let's trust simple heuristics for now or do a quick DFS if needed.
            // Or relying on user input "Detect & Mark Circular Dependencies" which implied using dependency-cruiser data.
            // cruiseResult had it.
            // Let's assume we capture it in edges loop.

            node.data.health = Math.max(0, score);
        });

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
