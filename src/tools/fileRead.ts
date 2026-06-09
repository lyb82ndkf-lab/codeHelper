// File Read Tool - Ported from claw-code-main file_ops.rs
// Features: line ranges, binary detection, size limits

import * as fs from 'fs';
import * as path from 'path';
import type { AgentTool } from '../agent/types';

const MAX_READ_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_LINES = 2000;

export const fileReadTool: AgentTool = {
    name: 'read_file',
    description: 'Read the contents of a file. Supports line ranges. Returns file content with line numbers.',
    inputSchema: {
        type: 'object',
        properties: {
            file_path: { type: 'string', description: 'Absolute path to the file' },
            offset: { type: 'number', description: 'Line number to start reading from (0-based)' },
            limit: { type: 'number', description: 'Maximum number of lines to read' },
        },
        required: ['file_path'],
    },

    async call(args) {
        const rawPath = args.file_path as string;
        const offset = (args.offset as number) || 0;
        const limit = (args.limit as number) || MAX_LINES;

        if (!rawPath) return 'Error: file_path is required';

        // 归一化路径
        const filePath = rawPath.replace(/\\\\/g, '\\').replace(/\//g, '\\');
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const absPath = path.isAbsolute(filePath) ? filePath
            : workspaceRoot ? path.join(workspaceRoot, filePath) : filePath;

        try {
            // Check file exists
            if (!fs.existsSync(absPath)) {
                // Try to find similar files
                const dir = path.dirname(absPath);
                const basename = path.basename(absPath);
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir);
                    const similar = files.filter(f =>
                        f.toLowerCase().includes(basename.toLowerCase().substring(0, 3))
                    );
                    if (similar.length > 0) {
                        return `Error: File "${rawPath}" not found.\nSimilar files: ${similar.join(', ')}`;
                    }
                }
                return `Error: File "${rawPath}" not found`;
            }

            const stat = fs.statSync(absPath);
            if (stat.size > MAX_READ_SIZE) {
                return `Error: File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max: 10MB.`;
            }

            // Binary check (look for NUL bytes)
            const buffer = Buffer.alloc(8192);
            const fd = fs.openSync(absPath, 'r');
            const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
            fs.closeSync(fd);
            for (let i = 0; i < bytesRead; i++) {
                if (buffer[i] === 0) {
                    return `Error: "${path.basename(absPath)}" appears to be a binary file.`;
                }
            }

            // Read content
            const content = fs.readFileSync(absPath, 'utf-8');
            const allLines = content.split('\n');
            const totalLines = allLines.length;

            const start = Math.min(offset, totalLines);
            const end = Math.min(start + limit, totalLines);
            const selectedLines = allLines.slice(start, end);

            // Format with line numbers
            const numbered = selectedLines.map((line, i) =>
                `${String(start + i + 1).padStart(4)} | ${line}`
            ).join('\n');

            const header = `File: ${absPath} (${totalLines} lines)`;
            const range = end < totalLines ? ` [showing ${start + 1}-${end} of ${totalLines}]` : '';
            return `${header}${range}\n\n${numbered}`;
        } catch (e: any) {
            return `Error reading "${absPath}": ${e.message}`;
        }
    },

    isReadOnly() { return true; },
};
