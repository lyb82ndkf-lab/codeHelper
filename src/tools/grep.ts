// Grep 内容搜索工具 - 参考 cc-haha 的 GrepTool

import * as vscode from 'vscode';
import type { AgentTool } from '../agent/types';

export const grepTool: AgentTool = {
    name: 'grep',
    description: '在文件内容中搜索正则表达式。返回匹配的文件和行。',
    inputSchema: {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: '正则表达式搜索模式' },
            path: { type: 'string', description: '搜索的文件或目录路径（可选）' },
            glob: { type: 'string', description: '文件过滤 glob 模式，如 "*.ts"' },
        },
        required: ['pattern'],
    },

    async call(args) {
        const pattern = args.pattern as string;
        const searchPath = args.path as string | undefined;
        const fileGlob = args.glob as string | undefined;

        try {
            // 构建文件查找的 glob
            const filePattern = fileGlob || '**/*';
            const files = await vscode.workspace.findFiles(
                searchPath ? `${searchPath}/${fileGlob || '*'}` : filePattern,
                '**/node_modules/**',
                200
            );

            const regex = new RegExp(pattern, 'g');
            const results: string[] = [];
            let matchCount = 0;

            for (const file of files) {
                if (matchCount > 200) {
                    results.push(`... 已达匹配上限 (${matchCount} 行)`);
                    break;
                }

                try {
                    const doc = await vscode.workspace.openTextDocument(file);
                    const relPath = vscode.workspace.asRelativePath(file);
                    const text = doc.getText();
                    const lines = text.split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        if (regex.test(lines[i])) {
                            results.push(`${relPath}:${i + 1}: ${lines[i].trim().substring(0, 200)}`);
                            matchCount++;
                            if (matchCount > 200) { break; }
                        }
                        regex.lastIndex = 0; // 重置正则状态
                    }
                } catch { /* skip binary files */ }
            }

            if (results.length === 0) {
                return `未找到匹配 "${pattern}" 的内容`;
            }
            return `找到 ${matchCount} 处匹配:\n${results.join('\n')}`;
        } catch (e: any) {
            return `搜索失败: ${e.message}`;
        }
    },

    isReadOnly() { return true; },
};
