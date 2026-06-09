// Bash/终端执行工具 v1.0.0 - 异步执行，不阻塞事件循环

import * as vscode from 'vscode';
import { exec } from 'child_process';
import type { AgentTool } from '../agent/types';

export const bashTool: AgentTool = {
    name: 'bash',
    description: '执行终端命令。可以运行构建、测试、安装依赖、查看文件列表等任何 shell 命令。',
    inputSchema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: '要执行的 shell 命令' },
            cwd: { type: 'string', description: '工作目录（可选，默认为项目根目录）' },
            timeout: { type: 'number', description: '超时时间毫秒（默认 30000）' },
        },
        required: ['command'],
    },

    async call(args) {
        const command = args.command as string;
        const cwd = args.cwd as string | undefined;
        const timeout = Math.min((args.timeout as number) || 30000, 300_000); // 最大 5 分钟

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath = workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        const execCwd = cwd || workspacePath;

        return new Promise<string>((resolve) => {
            const child = exec(command, {
                cwd: execCwd,
                timeout,
                encoding: 'utf-8',
                maxBuffer: 1024 * 1024,
                env: { ...process.env, FORCE_COLOR: '0' },
                windowsHide: true,
            }, (error, stdout, stderr) => {
                if (error) {
                    let msg = `命令执行失败 (退出码: ${error.code || '未知'})`;
                    if (stdout) { msg += `\n\nstdout:\n${String(stdout).substring(0, 3000)}`; }
                    if (stderr) { msg += `\n\nstderr:\n${String(stderr).substring(0, 3000)}`; }
                    resolve(msg);
                } else {
                    const output = String(stdout || '').trim();
                    if (output.length > 8000) {
                        resolve(output.substring(0, 4000) + '\n\n... [输出截断，共 ' + output.length + ' 字符] ...\n\n' + output.substring(output.length - 2000));
                    } else {
                        resolve(output || '(命令执行成功，无输出)');
                    }
                }
            });

            // 进程超时强制杀掉
            setTimeout(() => {
                try { child.kill('SIGTERM'); } catch { /* ignore */ }
            }, timeout + 1000);
        });
    },
};
