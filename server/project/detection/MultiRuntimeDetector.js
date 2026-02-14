const {
    MonorepoStrategy,
    SubdirectoryStrategy,
    DockerStrategy,
    RootProjectStrategy
} = require('./strategies.js');

class MultiRuntimeDetector {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;

        // Initialize all strategies
        this.strategies = [
            new MonorepoStrategy(projectRoot),
            new SubdirectoryStrategy(projectRoot),
            new DockerStrategy(projectRoot),
            new RootProjectStrategy(projectRoot)
        ];
    }

    /**
     * Main detection method
     * Returns array of runtime configurations
     */
    async detectAll() {
        console.log('[Detector] Scanning project:', this.projectRoot);

        const allRuntimes = [];

        // Run all strategies in parallel
        const results = await Promise.all(
            this.strategies.map(async strategy => {
                try {
                    return await strategy.detect();
                } catch (error) {
                    console.error(`[Detector] Error in ${strategy.constructor.name}:`, error);
                    return [];
                }
            })
        );

        // Flatten results
        for (const runtimes of results) {
            allRuntimes.push(...runtimes);
        }

        console.log(`[Detector] Found ${allRuntimes.length} runtimes`);

        // Remove duplicates and prioritize
        const deduplicated = this.deduplicateRuntimes(allRuntimes);
        const prioritized = this.prioritizeRuntimes(deduplicated);

        return prioritized;
    }

    /**
     * Remove duplicate runtimes based on working directory
     */
    deduplicateRuntimes(runtimes) {
        const seen = new Map();

        for (const runtime of runtimes) {
            // Use workingDir + command key to dedup identical runtime configs
            // But we also want to avoid duplicate directories if they are just "root" vs "subdir"
            // Let's use workingDir as primary key, but allow different commands in same dir?
            // Actually, if we have "npm start" and "npm run dev" for same dir, we probably want the one with highest priority or just merge them?
            // For now, simple dedup by workingDir. If strategy A finds it, strategy B shouldn't duplicate it.

            const key = runtime.workingDir;

            // Keep the first occurrence (strategy order matters)
            if (!seen.has(key)) {
                seen.set(key, runtime);
            }
        }

        return Array.from(seen.values());
    }

    /**
     * Sort runtimes by priority
     */
    prioritizeRuntimes(runtimes) {
        const priorityOrder = {
            frontend: 1,
            backend: 2,
            api: 3,
            admin: 4,
            mobile: 5,
            main: 6,
            root: 6,
            infrastructure: 7,
            docs: 8,
            package: 9,
            monorepo: 10,
            custom: 99
        };

        return runtimes.sort((a, b) => {
            const aPriority = priorityOrder[a.category] || 99;
            const bPriority = priorityOrder[b.category] || 99;
            return aPriority - bPriority;
        });
    }
}

module.exports = { MultiRuntimeDetector };
