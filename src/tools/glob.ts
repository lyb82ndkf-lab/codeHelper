// Glob 文件搜索工具 - 参考 cc-haha 的 GlobTool

import * as vscode from 'vscode';
import type { AgentTool } from '../agent/types';
import { resolvePath } from './utils';
import * as path from 'path';

export const globTool: AgentTool = {
    name: 'glob',
    description: '按 glob 模式搜索文件。返回匹配的文件路径列表。支持 ** 递归匹配。',
    inputSchema: {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: 'glob 模式，如 "**/*.ts" 或 "src/**/*.test.js"' },
            path: { type: 'string', description: '搜索起始目录（可选，默认项目根目录）' },
        },
        required: ['pattern'],
    },

    async call(args) {
        const pattern = args.pattern as string;
        const searchPath = args.path as string | undefined;

        try {
            const basePath = searchPath ? resolvePath(searchPath) : getWorkspacePath();
            const fullPattern = path.join(basePath, pattern);
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 500);

            if (files.length === 0) {
                return `未找到匹配 "${pattern}" 的文件`;
            }

            const relPaths = files.map(f => {
                const rel = path.relative(getWorkspacePath(), f.fsPath);
                return rel.replace(/\\/g, '/');
            });

            return `找到 ${relPaths.length} 个文件:\n${relPaths.join('\n')}`;
        } catch (e: any) {
            return `搜索失败: ${e.message}`;
        }
    },

    isReadOnly() { return true; },
};
