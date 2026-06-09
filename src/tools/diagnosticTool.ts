// 诊断错误工具 + 右键集成

import * as vscode from 'vscode';
import type { AgentTool } from '../agent/types';

export const diagnosticTool: AgentTool = {
    name: 'read_diagnostics',
    description: '读取当前文件或指定文件的 VSCode 诊断信息（错误和警告），用于代码纠错。',
    inputSchema: {
        type: 'object',
        properties: {
            path: { type: 'string', description: '文件路径（可选，默认当前文件）' },
        },
    },
    async call(args) {
        const filePath = args.path as string | undefined;
        const diagnostics = filePath
            ? vscode.languages.getDiagnostics(vscode.Uri.file(filePath))
            : vscode.window.activeTextEditor
                ? vscode.languages.getDiagnostics(vscode.window.activeTextEditor.document.uri)
                : [];
        if (!diagnostics.length) { return '没有诊断问题'; }
        const sev: Record<number, string> = {
            [vscode.DiagnosticSeverity.Error]: '❌',
            [vscode.DiagnosticSeverity.Warning]: '⚠️',
        };
        return diagnostics.map(d =>
            `${sev[d.severity] || 'ℹ️'} 第${d.range.start.line + 1}行: ${d.message}`
        ).join('\n');
    },
    isReadOnly() { return true; },
};

// 构建诊断 prompt（供右键菜单使用）
export function buildDiagnosePrompt(): string {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return '请帮我分析代码问题'; }

    const selection = editor.selection;
    const code = selection.isEmpty ? '' : editor.document.getText(selection);
    const language = editor.document.languageId;
    const fileName = editor.document.fileName.split(/[/\\]/).pop() || '';

    // 获取诊断信息
    const diags = vscode.languages.getDiagnostics(editor.document.uri)
        .filter(d => d.severity === vscode.DiagnosticSeverity.Error || d.severity === vscode.DiagnosticSeverity.Warning);

    let diagText = '无';
    if (diags.length > 0) {
        diagText = diags.map(d => {
            const line = d.range.start.line + 1;
            const sev = d.severity === vscode.DiagnosticSeverity.Error ? '错误' : '警告';
            const lineText = editor.document.lineAt(d.range.start.line).text.trim();
            return `第${line}行 [${sev}]: ${d.message}\n  代码: ${lineText}`;
        }).join('\n\n');
    }

    let prompt = '';
    if (code) {
        prompt += `以下代码有错误，请分析原因并提供修复方案：\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    }
    prompt += `**文件**: ${fileName}\n**诊断信息**:\n${diagText}\n\n`;
    prompt += '请分析错误原因，给出修复后的完整代码。';
    return prompt;
}
