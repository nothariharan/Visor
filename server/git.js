const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');


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
        // Fallback on error
        try {
            const stats = await fs.stat(filePath);
            return { hasGit: false, lastModified: stats.mtime, error: 'Git command failed' };
        } catch (e) {
            return { hasGit: false, error: 'File access failed' };
        }
    }
}

module.exports = { getGitMetadata };
