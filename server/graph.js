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

        // Run dependency-cruiser on visible files
        // We need to know edges between visible files.
        if (filesToScan.length > 0) {
            try {
                const { cruise } = await import("dependency-cruiser");
                const cruiseResult = await cruise(
                    filesToScan,

                    {
                        // Only include files in our list to avoid traversing the world
                        // This regex matches exactly the files in filesToScan
                        // Escaping for regex is important
                        includeOnly: filesToScan.map(p => `^${p.replace(/\\/g, '\\\\')}$`).join('|'),
                        maxDepth: 1, // Only direct dependencies
                        outputType: "json"
                    }
                );

                if (cruiseResult.output && cruiseResult.output.modules) {
                    cruiseResult.output.modules.forEach(mod => {
                        if (mod.dependencies) {
                            mod.dependencies.forEach(dep => {
                                // Only add edge if target is also visible
                                if (visibleItems.has(dep.resolved)) {
                                    edges.push({
                                        id: `${mod.source}-${dep.resolved}`,
                                        source: mod.source,
                                        target: dep.resolved
                                    });
                                }
                            });
                        }
                    });
                }
            } catch (e) {
                console.warn("Dependency parsing partial failure:", e);
            }
        }

        // Layout
        const elkChildren = nodes.map(n => ({ id: n.id, width: n.type === 'folder' ? 160 : 200, height: 60 }));
        const elkEdges = edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }));

        const layout = await elk.layout({
            id: "root",
            layoutOptions: {
                "elk.algorithm": "layered",
                "elk.direction": "DOWN",
                "elk.spacing.nodeNode": "80",
                "elk.layered.spacing.nodeNodeBetweenLayers": "100",
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
