// 工具辅助函数

import * as vscode from 'vscode';
import * as path from 'path';

export function resolvePath(filePath: string): string {
    // 如果是绝对路径，直接返回
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    // 相对于工作区
    const workspacePath = getWorkspacePath();
    return path.join(workspacePath, filePath);
}

export function getWorkspacePath(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        return folders[0].uri.fsPath;
    }
    return process.cwd();
}
