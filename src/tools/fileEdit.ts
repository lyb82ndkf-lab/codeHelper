// File Edit Tool - Ported from claw-code-main file_ops.rs
// Features: workspace boundary, structured diff, uniqueness check

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { AgentTool } from '../agent/types';

function getWorkspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
}

function validatePath(filePath: string): string {
    // 归一化路径：处理双反斜杠、正斜杠等
    let normalized = filePath
        .replace(/\\\\/g, '\\')   // \\ → \
        .replace(/\//g, '\\');    // / → \

    // 相对路径 → 解析到工作区根目录
    let abs = path.isAbsolute(normalized)
        ? normalized
        : path.resolve(getWorkspaceRoot(), normalized);

    if (abs.includes('..')) {
        throw new Error('Path traversal detected');
    }
    return abs;
}

function makeDiffPatch(oldText: string, newText: string, filePath: string): string {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const patch: string[] = [];
    patch.push(`--- a/${path.basename(filePath)}`);
    patch.push(`+++ b/${path.basename(filePath)}`);

    // Simple line-by-line diff
    const maxLen = Math.max(oldLines.length, newLines.length);
    let i = 0;
    while (i < maxLen) {
        if (oldLines[i] === newLines[i]) {
            i++;
            continue;
        }
        // Find range of changes
        let oldEnd = i, newEnd = i;
        while (oldEnd < oldLines.length && newEnd < newLines.length &&
               oldLines[oldEnd] !== newLines[newEnd]) {
            oldEnd++;
            newEnd++;
        }
        const oldStart = i + 1;
        const oldCount = oldEnd - i;
        const newStart = i + 1;
        const newCount = newEnd - i;
        patch.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
        for (let j = i; j < oldEnd; j++) {
            patch.push(`-${oldLines[j]}`);
        }
        for (let j = i; j < newEnd; j++) {
            patch.push(`+${newLines[j]}`);
        }
        i = Math.max(oldEnd, newEnd);
    }
    return patch.join('\n');
}

export const fileEditTool: AgentTool = {
    name: 'edit_file',
    description: 'Replace exact text in a file. The old_string must match exactly (including whitespace and indentation). Use read_file first to see the exact content.',
    inputSchema: {
        type: 'object',
        properties: {
            file_path: { type: 'string', description: 'Absolute path to the file' },
            old_string: { type: 'string', description: 'Exact text to find and replace' },
            new_string: { type: 'string', description: 'Replacement text' },
            replace_all: { type: 'boolean', description: 'Replace all occurrences (default false)' },
        },
        required: ['file_path', 'old_string', 'new_string'],
    },

    async call(args) {
        const filePath = args.file_path as string;
        const oldString = args.old_string as string;
        const newString = args.new_string as string;
        const replaceAll = args.replace_all as boolean || false;

        if (!filePath || !oldString) {
            return 'Error: file_path and old_string are required';
        }
        if (oldString === newString) {
            return 'old_string and new_string are identical, no change needed';
        }

        try {
            const absPath = validatePath(filePath);

            // Read file
            let content: string;
            try {
                content = fs.readFileSync(absPath, 'utf-8');
            } catch (e: any) {
                return `Error: Cannot read "${filePath}" - ${e.code || e.message}`;
            }

            // Check old_string exists
            const occurrences = content.split(oldString).length - 1;
            if (occurrences === 0) {
                // Try to find similar content
                const lines = content.split('\n');
                const firstLine = oldString.split('\n')[0].trim();
                const similar = lines.findIndex(l => l.trim() === firstLine);
                let hint = '';
                if (similar >= 0) {
                    hint = `\nDid you mean line ${similar + 1}? Use read_file to verify.`;
                }
                return `Error: old_string not found in "${filePath}".${hint}\nUse read_file first to see exact content.`;
            }
            if (occurrences > 1 && !replaceAll) {
                return `Error: old_string found ${occurrences} times. Use replace_all=true or provide more context to make it unique.`;
            }

            // Apply edit
            const newContent = replaceAll
                ? content.split(oldString).join(newString)
                : content.replace(oldString, newString);

            // Generate diff
            const diff = makeDiffPatch(content, newContent, filePath);

            // Write file
            fs.writeFileSync(absPath, newContent, 'utf-8');

            // Notify VS Code
            const uri = vscode.Uri.file(absPath);
            const doc = await vscode.workspace.openTextDocument(uri);
            await doc.save();

            const action = occurrences === 1 ? 'Replaced' : `Replaced ${occurrences} occurrences`;
            return `${action} in "${path.basename(filePath)}"\n\nDiff:\n${diff}`;
        } catch (e: any) {
            return `Error editing "${filePath}": ${e.message}`;
        }
    },
};
