// Agent 循环 v1.0.0 - 修复 abort 传递 + 超时 + 工具执行
// 核心流程: 用户输入 → 构建消息 → 调用 API → 处理 tool_use → 执行工具 → 循环

import * as vscode from 'vscode';
import { chatStream, type ApiMessage, type ApiTool, buildToolDefs } from '../models/apiClient';
import { findTool, allTools } from '../tools/index';
import { buildSystemPrompt } from './systemPrompt';
import { getConfig } from '../utils/config';
import { validateCommand, classifyCommand, getCommandDescription } from '../tools/bashValidation';
import { logAgentTurn, logAgentToolCall, logAgentToolResult, logAgentTextParse, logAgentError } from '../utils/logger';
import type { AgentConfig, AgentEventType } from './types';

export interface AgentCallbacks {
    permissionMode?: 'half' | 'full';
    onEvent(event: AgentEventType): void;
}

const TOOL_EXECUTION_TIMEOUT = 30_000;
const MAX_TURNS = 5; // 硬性轮次上限，防止死循环

export async function agentLoop(
    userMessage: string,
    history: ApiMessage[],
    callbacks: AgentCallbacks,
    abortSignal?: AbortSignal,
): Promise<ApiMessage[]> {
    const config = getConfig();
    const agentConfig: AgentConfig = {
        model: config.chatModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        maxTurns: config.maxAgentTurns,
        enableTools: config.enableAgent,
    };

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const messages: ApiMessage[] = [...history, { role: 'user', content: userMessage }];
    // 小模型不支持原生工具调用，使用文本格式（工具调用: name(args)）更可靠
    // 只为非 Ollama 提供商使用原生工具
    const toolDefs = (agentConfig.enableTools && config.provider !== 'ollama')
        ? buildToolDefs(allTools) : undefined;

    let turn = 0;
    const MAX_RECOVERY = 3;
    let recoveryCount = 0;
    let usedTools = false; // 跟踪是否使用过工具

    const maxTurns = Math.min(agentConfig.maxTurns, MAX_TURNS);
    while (turn < maxTurns) {
        if (abortSignal?.aborted) {
            callbacks.onEvent({ type: 'aborted' });
            break;
        }

        turn++;
        callbacks.onEvent({ type: 'turn_start', turn });
        logAgentTurn(turn, agentConfig.model);

        const requestMessages = buildRequestMessages(messages, workspacePath);
        let fullText = '';
        let toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
        let currentToolCall: { id: string; name: string; arguments: string } | null = null;
        let hasError = false;

        // 调用 API - 传递 abort signal
        try {
            for await (const event of chatStream(
                requestMessages,
                toolDefs,
                {
                    model: agentConfig.model,
                    temperature: agentConfig.temperature,
                    maxTokens: agentConfig.maxTokens,
                    abortSignal,
                }
            )) {
                if (abortSignal?.aborted) {
                    callbacks.onEvent({ type: 'aborted' });
                    return messages;
                }

                try {
                    switch (event.type) {
                        case 'text_delta':
                            fullText += event.text;
                            callbacks.onEvent({ type: 'text_delta', text: event.text });
                            break;
                        case 'thinking':
                            callbacks.onEvent({ type: 'text_delta', text: event.text });
                            break;
                        case 'tool_use_start':
                            currentToolCall = { id: event.id, name: event.name, arguments: '' };
                            callbacks.onEvent({ type: 'text_delta', text: `\n> Calling: ${event.name}\n` });
                            break;
                        case 'tool_use_delta':
                            if (currentToolCall) { currentToolCall.arguments += event.input_json_delta; }
                            break;
                        case 'tool_use_stop':
                            if (currentToolCall) {
                                toolCalls.push(currentToolCall);
                                callbacks.onEvent({ type: 'tool_use', name: currentToolCall.name, args: parseToolArgs(currentToolCall.arguments) });
                                currentToolCall = null;
                            }
                            break;
                        case 'error':
                            hasError = true;
                            callbacks.onEvent({ type: 'error', error: event.error });
                            if (event.error.includes('prompt') && event.error.includes('too long')) {
                                recoveryCount++;
                                if (recoveryCount < MAX_RECOVERY) {
                                    messages.splice(1, Math.floor(messages.length / 2));
                                    callbacks.onEvent({ type: 'text_delta', text: '\n[Context trimmed]\n' });
                                    continue;
                                }
                            }
                            break;
                        case 'done': break;
                    }
                } catch (evErr: any) { console.error('[Agent] event error:', evErr); }
            }
        } catch (e: any) {
            if (e.name === 'AbortError' || abortSignal?.aborted) {
                callbacks.onEvent({ type: 'aborted' });
                break;
            }
            callbacks.onEvent({ type: 'error', error: `API error: ${e.message}` });
            logAgentError(turn, e.message);
            break;
        }

        // API 报错时直接结束，不再进行下一轮
        if (hasError) {
            callbacks.onEvent({ type: 'done', messageCount: messages.length });
            return messages;
        }

        // 保存 assistant 回复
        if (fullText || toolCalls.length > 0) {
            const assistantMsg: ApiMessage = { role: 'assistant', content: fullText || '' };
            if (toolCalls.length > 0) {
                assistantMsg.tool_calls = toolCalls.map(tc => ({
                    id: tc.id,
                    type: 'function',
                    function: { name: tc.name, arguments: tc.arguments },
                }));
            }
            messages.push(assistantMsg);
        }

        // 无原生工具调用 → 尝试从文本中解析
        if (toolCalls.length === 0) {
            logAgentTextParse(fullText);
            const textToolCalls = parseToolCallsFromText(fullText);
            if (textToolCalls.length > 0) {
                toolCalls = textToolCalls;
                for (const tc of toolCalls) {
                    logAgentToolCall(turn, tc.name, tc.arguments);
                    // 发送工具调用事件，前端显示格式化卡片
                    callbacks.onEvent({ type: 'tool_use', name: tc.name, args: parseToolArgs(tc.arguments) });
                }
            }
        }

        // 没有任何工具调用 → 模型给出了纯文本回答，直接结束
        if (toolCalls.length === 0) {
            callbacks.onEvent({ type: 'done', messageCount: messages.length });
            return messages;
        }

        // 有工具调用 → 执行工具
        if (agentConfig.enableTools) {
            usedTools = true;
            const toolResults = await executeTools(toolCalls, abortSignal, callbacks.permissionMode);

            for (const result of toolResults) {
                logAgentToolResult(turn, result.name, result.result.length, result.isError);
                callbacks.onEvent({
                    type: 'tool_result',
                    name: result.name,
                    result: result.result,
                    isError: result.isError,
                });

                messages.push({
                    role: 'tool',
                    content: result.result,
                    tool_call_id: result.toolCallId,
                });
            }

            // 工具执行完毕后，添加继续提示让模型总结结果
            // 只在前 3 轮执行，避免无限循环
            if (!abortSignal?.aborted && turn < 3) {
                messages.push({
                    role: 'user',
                    content: '工具已执行完毕。请根据结果简要总结你做了什么。如果任务完成，直接回复用户。',
                });
            }
        }
    }

    if (turn >= maxTurns) {
        callbacks.onEvent({ type: 'text_delta', text: '\n\n[已达最大轮次限制]' });
    }
    callbacks.onEvent({ type: 'done', messageCount: messages.length });
    return messages;
}

// ============ 辅助函数 ============

function buildRequestMessages(messages: ApiMessage[], workspacePath: string): ApiMessage[] {
    const result: ApiMessage[] = [];
    result.push({ role: 'system', content: buildSystemPrompt(workspacePath) });
    for (const msg of messages) {
        if (msg.role === 'system' && result.length === 1) { continue; }
        result.push(msg);
    }
    return result;
}

async function executeTools(
    toolCalls: Array<{ id: string; name: string; arguments: string }>,
    abortSignal?: AbortSignal,
    permissionMode?: 'half' | 'full'
): Promise<Array<{ toolCallId: string; name: string; result: string; isError: boolean }>> {
    const results = [];
    const alwaysAllow = new Set<string>(); // 用户选择 "Allow Always" 的工具

    for (const tc of toolCalls) {
        if (abortSignal?.aborted) { break; }

        const tool = findTool(tc.name);
        if (!tool) {
            // 给出有用的错误信息，包含正确格式
            const toolNames = allTools.map(t => t.name).join(', ');
            const hint = getToolHint(tc.name);
            results.push({
                toolCallId: tc.id,
                name: tc.name,
                result: `Unknown tool "${tc.name}". ${hint}\nAvailable tools: ${toolNames}`,
                isError: true,
            });
            continue;
        }

        try {
            const args = parseToolArgs(tc.arguments);

            // 权限检查：edit_file 和 write_file 需要用户确认（full 模式跳过）
            if ((tc.name === 'edit_file' || tc.name === 'write_file') && permissionMode !== 'full') {
                const filePath = (args.file_path as string) || (args.path as string) || 'unknown';
                const shortPath = filePath.split(/[/\\]/).pop() || filePath;

                const choice = await vscode.window.showWarningMessage(
                    `允许 ${tc.name} 修改 "${shortPath}"？`,
                    { modal: false },
                    '允许', '始终允许', '拒绝'
                );

                if (choice === '拒绝' || !choice) {
                    results.push({
                        toolCallId: tc.id,
                        name: tc.name,
                        result: '用户拒绝了此操作。',
                        isError: true,
                    });
                    continue;
                }
                // "始终允许" - 跳过后续确认
                if (choice === '始终允许') {
                    alwaysAllow.add(tc.name);
                }
            } else if (tc.name === 'bash' && permissionMode !== 'full') {
                // bash: 只读命令自动允许，写入/破坏性命令需要确认
                const cmd = (args.command as string) || '';
                if (!alwaysAllow.has('bash')) {
                    // 验证命令
                    const validation = validateCommand(cmd, false);
                    if (!validation.ok) {
                        results.push({
                            toolCallId: tc.id,
                            name: tc.name,
                            result: validation.reason,
                            isError: true,
                        });
                        continue;
                    }

                    // 只读命令自动允许，无需弹窗
                    const intent = classifyCommand(cmd);
                    if (intent === 'ReadOnly') {
                        // 直接执行，不弹窗
                    } else {
                        const desc = getCommandDescription(cmd);
                        const choice = await vscode.window.showWarningMessage(
                            `[${desc}] ${cmd.substring(0, 80)}${cmd.length > 80 ? '...' : ''}`,
                            { modal: false },
                            '允许', '始终允许', '拒绝'
                        );
                        if (choice === '拒绝' || !choice) {
                            results.push({
                                toolCallId: tc.id,
                                name: tc.name,
                                result: '用户拒绝了此操作。',
                                isError: true,
                            });
                            continue;
                        }
                        if (choice === '始终允许') {
                            alwaysAllow.add('bash');
                        }
                    }
                }
            }

            // 带超时的工具执行
            const result = await Promise.race([
                tool.call(args),
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error(`Tool timeout (${TOOL_EXECUTION_TIMEOUT / 1000}s)`)), TOOL_EXECUTION_TIMEOUT)
                ),
            ]);
            // 压缩结果：只保留关键信息
            const compactResult = compactToolResult(tc.name, result);
            results.push({ toolCallId: tc.id, name: tc.name, result: compactResult, isError: false });
        } catch (e: any) {
            results.push({
                toolCallId: tc.id,
                name: tc.name,
                result: `工具执行错误: ${e.message}`,
                isError: true,
            });
        }
    }

    return results;
}

function parseToolArgs(jsonStr: string): Record<string, unknown> {
    try { return JSON.parse(jsonStr || '{}'); }
    catch { return {}; }
}

function getToolHint(name: string): string {
    // 常见的名称混淆
    const aliases: Record<string, string> = {
        'read': '请使用 read_file(file_path: string)',
        'Read': '请使用 read_file(file_path: string)',
        'write': '请使用 write_file(file_path: string, content: string)',
        'Write': '请使用 write_file(file_path: string, content: string)',
        'edit': '请使用 edit_file(file_path: string, old_string: string, new_string: string)',
        'Edit': '请使用 edit_file(file_path: string, old_string: string, new_string: string)',
        'bash': '请使用 bash(command: string)',
        'Bash': '请使用 bash(command: string)',
        'glob': '请使用 glob_search(pattern: string)',
        'Glob': '请使用 glob_search(pattern: string)',
        'grep': '请使用 grep_search(pattern: string)',
        'Grep': '请使用 grep_search(pattern: string)',
        'file_read': '请使用 read_file(file_path: string)',
        'file_write': '请使用 write_file(file_path: string, content: string)',
        'file_edit': '请使用 edit_file(file_path: string, old_string: string, new_string: string)',
        'shell': '请使用 bash(command: string)',
        'execute': '请使用 bash(command: string)',
        'search': '请使用 grep_search(pattern: string)',
        'find': '请使用 glob_search(pattern: string)',
    };
    return aliases[name] || `可用工具：${Object.keys(aliases).join(', ')}`;
}

function compactToolResult(toolName: string, result: string): string {
    if (toolName === 'read_file') {
        const lines = result.split('\n');
        if (lines.length > 30) {
            return lines.slice(0, 21).join('\n') + '\n... (' + (lines.length - 26) + ' more lines) ...\n' + lines.slice(-5).join('\n');
        }
        return result;
    }
    if (toolName === 'bash' && result.length > 2000) {
        return result.substring(0, 1000) + '\n... (' + result.length + ' chars) ...\n' + result.substring(result.length - 500);
    }
    if (result.length > 1500) { return result.substring(0, 1500) + '\n... (truncated)'; }
    return result;
}

// Parse tool calls from text when API doesn't return tool_calls
function parseToolCallsFromText(text: string): Array<{ id: string; name: string; arguments: string }> {
    const calls: Array<{ id: string; name: string; arguments: string }> = [];

    // Step 1: 提取代码块内容（优先匹配）
    const codeBlocks: string[] = [];
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    let cbMatch;
    while ((cbMatch = codeBlockRegex.exec(text)) !== null) {
        codeBlocks.push(cbMatch[1]);
    }

    // Step 2: 主要格式 — 工具调用: name(args)（支持多行参数）
    const mainRegex = /(?:工具调用|tool_call|Tool Call|ToolCall)\s*[:：]\s*(\w+)\s*\(([\s\S]*?)\)\s*$/gm;
    let match;
    while ((match = mainRegex.exec(text)) !== null) {
        const name = match[1];
        const argsStr = match[2];
        const args = parseToolArguments(argsStr);
        calls.push({
            id: `tc_${Date.now()}_${calls.length}`,
            name,
            arguments: JSON.stringify(args),
        });
    }

    // Step 3: 备用 — 从代码块中提取 tool_name(args) 调用
    if (calls.length === 0 && codeBlocks.length > 0) {
        for (const block of codeBlocks) {
            const toolCallRegex = /(\w+)\s*\(([^)]*)\)/g;
            let tcMatch;
            while ((tcMatch = toolCallRegex.exec(block)) !== null) {
                const name = tcMatch[1];
                // 只匹配已知工具名
                if (['read_file', 'edit_file', 'write_file', 'bash', 'glob_search', 'grep_search'].includes(name)) {
                    const args = parseToolArguments(tcMatch[2]);
                    calls.push({
                        id: `tc_${Date.now()}_${calls.length}`,
                        name,
                        arguments: JSON.stringify(args),
                    });
                }
            }
        }
    }

    // Step 4: 通用备用 — 在整个文本中搜索 tool_name(key="value", ...) 格式
    if (calls.length === 0) {
        const knownTools = ['edit_file', 'write_file', 'read_file', 'bash', 'glob_search', 'grep_search'];
        for (const toolName of knownTools) {
            const regex = new RegExp(toolName + '\\s*\\(([\\s\\S]*?)\\)', 'g');
            let toolMatch;
            while ((toolMatch = regex.exec(text)) !== null) {
                const args = parseToolArguments(toolMatch[1]);
                // edit_file 需要 file_path 和 old_string
                if (toolName === 'edit_file' && (!args.file_path || !args.old_string)) continue;
                if (toolName === 'write_file' && !args.file_path) continue;
                if (toolName === 'read_file' && !args.file_path) continue;
                if (toolName === 'bash' && !args.command) continue;
                calls.push({
                    id: `tc_${Date.now()}_${calls.length}`,
                    name: toolName,
                    arguments: JSON.stringify(args),
                });
            }
        }
    }

    return calls;
}

// 解析 "key1=value1, key2=value2" 格式的参数
function parseToolArguments(argsStr: string): Record<string, string> {
    const args: Record<string, string> = {};
    // 匹配 key="value" 或 key='value' 或 key=value
    const argRegex = /(\w+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([\w./\\:-]+))/g;
    let argMatch;
    while ((argMatch = argRegex.exec(argsStr)) !== null) {
        const key = argMatch[1];
        const value = argMatch[2] ?? argMatch[3] ?? argMatch[4] ?? '';
        // 处理转义字符（顺序重要：先处理 \\ 再处理其他）
        args[key] = value.replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
    }
    return args;
}
