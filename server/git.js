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
    undoLastCommit
};
