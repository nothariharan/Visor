const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

class AIFixService {
    constructor(apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    }

    async fixError(filePath, errorContext) {
        try {
            // 1. Read the errored file
            const fileContent = await fs.readFile(filePath, 'utf-8');

            // 2. Read related files (imports)
            const imports = await this.extractImports(filePath, fileContent);
            const importContents = await this.readImports(filePath, imports);

            // 3. Build context for AI
            const context = this.buildContext(
                fileContent,
                errorContext,
                importContents
            );

            // 4. Generate fix
            const fixedCode = await this.generateFix(context);

            // 5. Validate fix (basic)
            if (!this.validateFix(fixedCode, fileContent)) {
                return {
                    success: false,
                    error: 'Generated fix appears invalid or identical to the previous file.'
                };
            }

            // 6. Create backup
            await this.createBackup(filePath, fileContent);

            // 7. Apply fix
            await fs.writeFile(filePath, fixedCode, 'utf-8');

            return {
                success: true,
                message: 'Fix applied successfully.',
                diff: this.createDiff(fileContent, fixedCode)
            };

        } catch (error) {
            console.error('[AIFixService] Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async extractImports(filePath, content) {
        const imports = [];

        // Match ES6 imports
        const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        // Match CommonJS requires
        const requireRegex = /require\s*\(\s*['"](.+?)['"]\s*\)/g;

        while ((match = requireRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        // Filter to local files only (not node_modules)
        return imports.filter(imp => imp.startsWith('.'));
    }

    async readImports(basePath, imports) {
        const baseDir = path.dirname(basePath);
        const contents = {};

        for (const imp of imports) {
            try {
                // Resolve relative path
                let impPath = path.join(baseDir, imp);

                // Add extensions if missing
                if (!path.extname(impPath)) {
                    for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
                        if (await this.fileExists(impPath + ext)) {
                            impPath += ext;
                            break;
                        }
                    }
                }

                if (await this.fileExists(impPath)) {
                    contents[imp] = await fs.readFile(impPath, 'utf-8');
                }
            } catch {
                // Skip if can't read
            }
        }

        return contents;
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    buildContext(fileContent, errorContext, importContents) {
        let context = `# File with Error\n\n`;
        context += `\`\`\`javascript\n${fileContent}\n\`\`\`\n\n`;

        context += `# Error Information\n\n`;
        context += `Type: ${errorContext.type || 'Unknown'}\n`;
        context += `Message: ${errorContext.message || 'No message'}\n`;
        context += `Line: ${errorContext.line || 'Unknown'}\n`;
        context += `Column: ${errorContext.column || 'Unknown'}\n\n`;

        if (errorContext.stack) {
            context += `Stack Trace:\n\`\`\`\n${errorContext.stack}\n\`\`\`\n\n`;
        }

        if (Object.keys(importContents).length > 0) {
            context += `# Related Files (Limited Context)\n\n`;

            for (const [imp, content] of Object.entries(importContents)) {
                context += `## ${imp}\n\n`;
                context += `\`\`\`javascript\n${content.substring(0, 1000)}\n\`\`\`\n\n`;
            }
        }

        return context;
    }

    async generateFix(context) {
        const prompt = `You are an expert full-stack developer AI assistant. Your task is to fix the runtime/compile error in the provided file.

${context}

CRITICAL INSTRUCTIONS:
1. Identify the bug based on the error message and the code.
2. Return ONLY the fully fixed code for the entire file. Do not omit any part of the file.
3. The response must be valid code ready to be saved without any modifications.
4. DO NOT wrap the code in markdown code fences like \`\`\`javascript or \`\`\`. Start immediately with the raw code.
5. Provide NO explanations, text, or comments about the changes. Just the code itself.
6. Preserve all imports, exports, styling, and general file structure. Fix ONLY the erroneous part.

Return the complete fixed code now:`;

        const result = await this.model.generateContent(prompt);
        let fixedCode = result.response.text();

        // Clean up response (remove markdown if AI failed to listen)
        if (fixedCode.startsWith('```')) {
            fixedCode = fixedCode.replace(/^```[a-z]*\n?/i, '');
            fixedCode = fixedCode.replace(/\n?```$/i, '');
        }

        return fixedCode.trim();
    }

    validateFix(fixedCode, originalCode) {
        if (!fixedCode || fixedCode.length < 10) return false;
        if (fixedCode.startsWith('Here') || fixedCode.startsWith('I ')) return false;

        const codePatterns = [/function/, /const|let|var/, /import|export/, /\{.*\}/s, /=>/, /class /];
        const hasCode = codePatterns.some(pattern => pattern.test(fixedCode));
        if (!hasCode) return false;

        const similarity = this.calculateSimilarity(fixedCode, originalCode);
        if (similarity > 0.999) return false; // Basically unmodified

        return true;
    }

    calculateSimilarity(str1, str2) {
        const minLen = Math.min(str1.length, str2.length);
        const maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0) return 1.0;

        let matches = 0;
        for (let i = 0; i < minLen; i++) {
            if (str1[i] === str2[i]) matches++;
        }
        return matches / maxLen;
    }

    async createBackup(filePath, content) {
        // Save in <project>/.visor/backups
        // We traverse up to find .visor or just put it in a local .visor dir
        const baseDir = process.cwd();
        const backupDir = path.join(baseDir, '.visor', 'backups');

        if (!fsSync.existsSync(backupDir)) {
            await fs.mkdir(backupDir, { recursive: true });
        }

        const timestamp = Date.now();
        const fileName = path.basename(filePath);
        const safeTitle = fileName.replace(/[^a-zA-Z0-9.\-]/g, '_');
        const backupPath = path.join(backupDir, `${safeTitle}.${timestamp}.bak`);

        await fs.writeFile(backupPath, content, 'utf-8');
    }

    createDiff(original, fixed) {
        const origLines = original.split('\n');
        const fixedLines = fixed.split('\n');
        const diff = [];
        const maxLen = Math.max(origLines.length, fixedLines.length);

        for (let i = 0; i < maxLen; i++) {
            const origLine = origLines[i] !== undefined ? origLines[i] : null;
            const fixedLine = fixedLines[i] !== undefined ? fixedLines[i] : null;

            if (origLine !== fixedLine) {
                if (origLine !== null) diff.push({ type: 'removed', line: origLine, lineNum: i + 1 });
                if (fixedLine !== null) diff.push({ type: 'added', line: fixedLine, lineNum: i + 1 });
            }
        }
        return diff;
    }
}
