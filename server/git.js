const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');

/**
 * Get basic metadata for a single file.
 */
async function getGitMetadata(filePath) {
    try {
        const git = simpleGit(path.dirname(filePath));
        const isRepo = await git.checkIsRepo();

        if (!isRepo) {
            const stats = await fs.stat(filePath);
            return {
                hasGit: false,
                lastModified: stats.mtime
            };
        }

        const log = await git.log({ file: filePath, maxCount: 1 });
        const status = await git.status();

        return {
            hasGit: true,
            lastCommit: log.latest ? log.latest.date : null,
            author: log.latest ? log.latest.author_name : null,
            isModified: status.modified.includes(filePath),
            commits: log.total
        };
    } catch (error) {
        console.error(`Error getting git metadata for ${filePath}:`, error);
        try {
            const stats = await fs.stat(filePath);
            return { hasGit: false, lastModified: stats.mtime, error: 'Git command failed' };
        } catch (e) {
            return { hasGit: false, error: 'File access failed' };
        }
    }
}

/**
 * Get full repository status including branch info and ahead/behind counts.
 */
async function getRepoStatus(rootDir) {
    try {
        const git = simpleGit(rootDir);
        const isRepo = await git.checkIsRepo();
        if (!isRepo) return { success: false, error: 'Not a git repository', type: 'REPO_ERROR' };

        const status = await git.status();
        return {
            success: true,
            branch: status.current,
            ahead: status.ahead,
            behind: status.behind,
            modified: status.modified,
            untracked: status.not_added,
            staged: status.staged,
            deleted: status.deleted,
            conflicted: status.conflicted,
            created: status.created,
            renamed: status.renamed
        };
    } catch (error) {
        return { success: false, error: error.message, type: 'REPO_ERROR' };
    }
}

async function stageFiles(rootDir, files) {
    try {
        const git = simpleGit(rootDir);
        await git.add(files);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message, type: 'STAGE_ERROR' };
    }
}

async function unstageFiles(rootDir, files) {
    try {
        const git = simpleGit(rootDir);
        await git.reset(['HEAD', ...files]);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message, type: 'UNSTAGE_ERROR' };
    }
}

async function commitChanges(rootDir, message) {
    try {
        const git = simpleGit(rootDir);
        await git.commit(message);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message, type: 'COMMIT_ERROR' };
    }
}

async function discardChanges(rootDir, files) {
    try {
        const git = simpleGit(rootDir);
        await git.checkout(['--', ...files]);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message, type: 'DISCARD_ERROR' };
    }
}

async function pushChanges(rootDir) {
    try {
        const git = simpleGit(rootDir);
        const result = await git.push();
        return { success: true, result };
    } catch (error) {
        if (error.message.includes('Could not resolve host') || error.message.includes('no such host')) {
            return { success: false, error: 'No internet connection', type: 'NETWORK_ERROR' };
        }
        if (error.message.includes('Authentication failed')) {
            return { success: false, error: 'Git authentication failed', type: 'AUTH_ERROR' };
        }
        return { success: false, error: error.message, type: 'PUSH_ERROR' };
    }
}

async function pullChanges(rootDir) {
    try {
        const git = simpleGit(rootDir);
        const result = await git.pull();
        const status = await git.status();

        if (status.conflicted.length > 0) {
            return {
                success: false,
                error: 'Pull succeeded but merge conflicts occurred',
                type: 'MERGE_CONFLICT',
                conflicts: status.conflicted
            };
        }

        return { success: true, result };
    } catch (error) {
        if (error.message.includes('Could not resolve host') || error.message.includes('no such host')) {
            return { success: false, error: 'No internet connection', type: 'NETWORK_ERROR' };
        }
        return { success: false, error: error.message, type: 'PULL_ERROR' };
    }
}

async function getFileDiff(rootDir, filePath) {
    try {
        const git = simpleGit(rootDir);
        const diff = await git.diff([filePath]);
        return { success: true, diff };
    } catch (error) {
        return { success: false, error: error.message, type: 'DIFF_ERROR' };
    }
}

async function undoLastCommit(rootDir) {
    try {
        const git = simpleGit(rootDir);
        await git.reset(['--soft', 'HEAD~1']);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message, type: 'UNDO_ERROR' };
    }
}

// --- Chronicle Time Travel Functions ---

const ORIGINAL_BRANCH_FILE = (rootDir) => path.join(rootDir, '.visor', 'original_branch.txt');

async function storeOriginalBranch(rootDir, branch) {
    try {
        await fs.ensureDir(path.join(rootDir, '.visor'));
        await fs.writeFile(ORIGINAL_BRANCH_FILE(rootDir), branch, 'utf-8');
    } catch (e) { /* ignore */ }
}

async function getOriginalBranch(rootDir) {
    try {
        return (await fs.readFile(ORIGINAL_BRANCH_FILE(rootDir), 'utf-8')).trim();
    } catch {
        return 'main';
    }
}

/**
 * Get commit history (last 100 commits).
 */
async function getCommitHistory(rootDir) {
    try {
        const git = simpleGit(rootDir);
        const isRepo = await git.checkIsRepo();
        if (!isRepo) return { success: false, error: 'Not a git repository' };

        const log = await git.log({ maxCount: 100 });
        return {
            success: true,
            commits: log.all.map(c => ({
                hash: c.hash,
                shortHash: c.hash.substring(0, 7),
                message: c.message,
                author: c.author_name,
                email: c.author_email,
                date: c.date,
                timestamp: new Date(c.date).getTime(),
                body: c.body || '',
                refs: c.refs || ''
            }))
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get the current HEAD state (branch or detached commit).
 */
async function getCurrentHead(rootDir) {
    try {
        const git = simpleGit(rootDir);
        const status = await git.status();

        if (status.detached) {
            const log = await git.log({ maxCount: 1 });
            return {
                success: true,
                isDetached: true,
                commit: log.latest ? log.latest.hash : null,
                shortCommit: log.latest ? log.latest.hash.substring(0, 7) : null,
                originalBranch: await getOriginalBranch(rootDir)
            };
        }

        return {
            success: true,
            isDetached: false,
            branch: status.current
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Check if the repository is in a safe state for time travel.
 */
async function checkSafety(rootDir) {
    try {
        const git = simpleGit(rootDir);
        const status = await git.status();

        const hasChanges =
            status.modified.length > 0 ||
            status.not_added.length > 0 ||
            status.created.length > 0 ||
            status.deleted.length > 0;

        const hasConflicts = status.conflicted.length > 0;

        return {
            success: true,
            safe: !hasConflicts,
            warnings: {
                uncommittedChanges: hasChanges,
                conflicts: hasConflicts
            },
            changedFiles: {
                modified: status.modified,
                added: status.not_added,
                deleted: status.deleted
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Parse a diff summary into categorized changes.
 */
function parseDiffToChanges(diffSummary) {
    const changes = { added: [], modified: [], deleted: [], renamed: [] };
    diffSummary.files.forEach(file => {
        if (file.binary) return;
        if (file.insertions > 0 && file.deletions === 0) {
            changes.added.push(file.file);
        } else if (file.insertions === 0 && file.deletions > 0) {
            changes.deleted.push(file.file);
        } else {
            changes.modified.push(file.file);
        }
    });
    return changes;
}

/**
 * Travel to a specific commit (git checkout <hash>).
 */
async function timeTravel(rootDir, targetHash, options = {}) {
    const git = simpleGit(rootDir);
    try {
        const safety = await checkSafety(rootDir);
        if (!safety.safe && !options.force) {
            return { success: false, error: 'Repository has conflicts', warnings: safety.warnings, requiresForce: true };
        }

        // Store current branch before detaching
        const current = await git.status();
        if (!current.detached) {
            await storeOriginalBranch(rootDir, current.current);
        }

        // Stash uncommitted changes if any
        let stashCreated = false;
        if (safety.warnings && safety.warnings.uncommittedChanges) {
            try {
                const stashMsg = `VISOR auto-stash before time travel to ${targetHash}`;
                const result = await git.stash(['save', stashMsg]);
                stashCreated = typeof result === 'string' && result.includes('Saved');
            } catch (e) { /* nothing to stash */ }
        }

        // Checkout the target commit
        await git.checkout(targetHash);

        // Calculate what changed in this commit
        let changes = { added: [], modified: [], deleted: [], renamed: [] };
        try {
            const diffSummary = await git.diffSummary([`${targetHash}^`, targetHash]);
            changes = parseDiffToChanges(diffSummary);
        } catch (e) {
            // First commit has no parent — skip diff
        }

        return { success: true, commit: targetHash, shortHash: targetHash.substring(0, 7), stashCreated, changes };
    } catch (error) {
        return { success: false, error: 'Checkout failed', details: error.message };
    }
}

/**
 * Return to the most recent branch from a detached HEAD state.
 */
async function returnToPresent(rootDir) {
    const git = simpleGit(rootDir);
    try {
        const originalBranch = await getOriginalBranch(rootDir);

        // Check if branch exists before checkout
        const branches = await git.branch();
        if (!branches.all.includes(originalBranch)) {
            return {
                success: false,
                error: `Original branch '${originalBranch}' not found`,
                recovery: `Try running 'git checkout main' manually or check your active branches.`
            };
        }

        await git.checkout(originalBranch);

        // Look for VISOR auto-stashes
        const stashes = await git.stashList();
        const visorStash = stashes.all.find(s => s.message.includes('VISOR auto-stash'));
        if (visorStash) {
            try {
                await git.stash(['pop', `stash@{${visorStash.index}}`]);
            } catch (e) {
                return {
                    success: true,
                    warning: 'Could not restore stashed changes (conflicts)',
                    stashPreserved: true,
                    branch: originalBranch,
                    recovery: 'Your changes are safe in a git stash. Run "git stash list" and "git stash pop" to restore them.'
                };
            }
        }

        // Clean up temp file
        try { await fs.remove(ORIGINAL_BRANCH_FILE(rootDir)); } catch (e) { /* ignore */ }

        return { success: true, branch: originalBranch };
    } catch (error) {
        return {
            success: false,
            error: 'Failed to return to present',
            details: error.message,
            recovery: 'Check for uncommitted changes or conflicts. Run: git checkout main && git stash pop'
        };
    }
}

/**
 * Get detailed info about a specific commit.
 */
async function getCommitDetails(rootDir, hash) {
    const git = simpleGit(rootDir);
    try {
        const log = await git.log({ from: hash, to: hash, maxCount: 1 });
        const commit = log.all[0];
        if (!commit) return { success: false, error: 'Commit not found' };

        let diffSummary = { files: [], insertions: 0, deletions: 0 };
        try {
            diffSummary = await git.diffSummary([`${hash}^`, hash]);
        } catch (e) { /* first commit, no parent */ }

        return {
            success: true,
            commit: {
                hash: commit.hash,
                shortHash: commit.hash.substring(0, 7),
                message: commit.message,
                author: commit.author_name,
                date: commit.date,
                body: commit.body || '',
                stats: {
                    filesChanged: diffSummary.files.length,
                    insertions: diffSummary.insertions,
                    deletions: diffSummary.deletions
                },
                files: diffSummary.files.map(f => ({
                    path: f.file,
                    insertions: f.insertions,
                    deletions: f.deletions
                }))
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    getGitMetadata,
    getRepoStatus,
    stageFiles,
    unstageFiles,
    commitChanges,
    discardChanges,
    pushChanges,
    pullChanges,
    getFileDiff,
    undoLastCommit,
    // Chronicle time travel
    getCommitHistory,
    getCurrentHead,
    checkSafety,
    timeTravel,
    returnToPresent,
    getCommitDetails
};

