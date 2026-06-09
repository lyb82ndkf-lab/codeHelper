// Logger v1.0 - 日志写入 .codeHelper/logs/ 文件夹
// 方便调试：补全请求、Agent 工具调用、错误信息

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let logDir = '';

export function initLogger(extensionUri?: vscode.Uri): void {
    // 优先写到工作区 .codeHelper/logs，没有工作区时写到用户目录
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    logDir = ws
        ? path.join(ws, '.codeHelper', 'logs')
        : path.join(process.env.USERPROFILE || process.env.HOME || '.', '.codeHelper', 'logs');
    try {
        fs.mkdirSync(logDir, { recursive: true });
    } catch { /* ignore */ }
}

function timestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function appendLog(category: string, message: string): void {
    if (!logDir) return;
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logFile = path.join(logDir, `${date}.log`);
    const line = `[${timestamp()}] [${category}] ${message}\n`;
    try {
        fs.appendFileSync(logFile, line, 'utf-8');
    } catch { /* ignore */ }
}

// ============ 补全日志 ============

export function logCompletionRequest(requestId: number, model: string, prefixLen: number, suffixLen: number, lang: string, file: string): void {
    appendLog('COMPLETION', `#${requestId} REQUEST  model=${model} lang=${lang} file=${file} prefix=${prefixLen}ch suffix=${suffixLen}ch`);
}

export function logCompletionResponse(requestId: number, rawLen: number, cleaned: string, duration: number): void {
    const preview = cleaned.substring(0, 200).replace(/\n/g, '\\n');
    appendLog('COMPLETION', `#${requestId} RESPONSE raw=${rawLen}ch cleaned=${cleaned.length}ch duration=${duration}ms result="${preview}"`);
}

export function logCompletionError(requestId: number, error: string): void {
    appendLog('COMPLETION', `#${requestId} ERROR   ${error}`);
}

export function logCompletionSkip(requestId: number, reason: string): void {
    appendLog('COMPLETION', `#${requestId} SKIP    ${reason}`);
}

// ============ Agent 日志 ============

export function logAgentTurn(turn: number, model: string): void {
    appendLog('AGENT', `Turn ${turn} model=${model}`);
}

export function logAgentToolCall(turn: number, name: string, args: string): void {
    const preview = args.substring(0, 300).replace(/\n/g, '\\n');
    appendLog('AGENT', `Turn ${turn} TOOL_CALL  ${name}(${preview})`);
}

export function logAgentToolResult(turn: number, name: string, resultLen: number, isError: boolean): void {
    appendLog('AGENT', `Turn ${turn} TOOL_RESULT ${name} len=${resultLen} error=${isError}`);
}

export function logAgentTextParse(text: string): void {
    // 记录模型输出中是否有工具调用痕迹
    const hasToolKeyword = text.includes('工具调用') || text.includes('tool_call');
    const hasEditFile = text.includes('edit_file');
    const hasReadFile = text.includes('read_file');
    const hasBash = text.includes('bash(');
    appendLog('AGENT', `TEXT_PARSE tools_kw=${hasToolKeyword} edit=${hasEditFile} read=${hasReadFile} bash=${hasBash} len=${text.length}`);
    if (hasToolKeyword || hasEditFile || hasReadFile || hasBash) {
        // 找到包含工具调用的行
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.includes('工具调用') || line.match(/edit_file|read_file|write_file|bash\s*\(/)) {
                appendLog('AGENT', `  MATCHED_LINE: ${line.substring(0, 200)}`);
            }
        }
    }
}

export function logAgentError(turn: number, error: string): void {
    appendLog('AGENT', `Turn ${turn} ERROR   ${error}`);
}

// ============ 通用日志 ============

export function logInfo(category: string, message: string): void {
    appendLog(category, message);
}

export function logError(category: string, message: string): void {
    appendLog(category, `ERROR: ${message}`);
}

export function getLogDir(): string {
    return logDir;
}
