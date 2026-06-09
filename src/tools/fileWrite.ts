// File Write Tool - Ported from claw-code-main file_ops.rs
// Features: create/update detection, structured diff, parent dir creation

import * as fs from 'fs';
import * as path from 'path';
import type { AgentTool } from '../agent/types';

const MAX_WRITE_SIZE = 10 * 1024 * 1024; // 10 MB

export const fileWriteTool: AgentTool = {
    name: 'write_file',
    description: 'Write content to a file. Creates parent directories if needed. Returns diff of changes.',
    inputSchema: {
        type: 'object',
        properties: {
            file_path: { type: 'string', description: 'Absolute path to the file' },
            content: { type: 'string', description: 'The complete content to write' },
        },
        required: ['file_path', 'content'],
    },

    async call(args) {
        const filePath = args.file_path as string;
        const content = args.content as string;

        if (!filePath) return 'Error: file_path is required';
        if (content === undefined) return 'Error: content is required';

        if (content.length > MAX_WRITE_SIZE) {
            return `Error: Content too large (${(content.length / 1024 / 1024).toFixed(1)}MB). Max: 10MB.`;
        }

        try {
            const exists = fs.existsSync(filePath);
            const originalContent = exists ? fs.readFileSync(filePath, 'utf-8') : '';

            // Create parent directories
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write file
            fs.writeFileSync(filePath, content, 'utf-8');

            // Generate summary
            const newLines = content.split('\n').length;
            const action = exists ? 'Updated' : 'Created';

            if (exists && originalContent !== content) {
                // Generate simple diff
                const oldLines = originalContent.split('\n');
                const newLinesArr = content.split('\n');
                let added = 0, removed = 0;
                const maxLen = Math.max(oldLines.length, newLinesArr.length);
                for (let i = 0; i < maxLen; i++) {
                    if (oldLines[i] !== newLinesArr[i]) {
                        if (i >= oldLines.length) added++;
                        else if (i >= newLinesArr.length) removed++;
                        else { added++; removed++; }
                    }
                }
                return `${action} "${path.basename(filePath)}" (${newLines} lines, +${added}/-${removed})`;
            }

            return `${action} "${path.basename(filePath)}" (${newLines} lines)`;
        } catch (e: any) {
            return `Error writing "${filePath}": ${e.message}`;
        }
    },
};
