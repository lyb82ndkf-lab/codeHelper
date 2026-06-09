// 统一 API 客户端 v1.0.0 - 修复 abort 信号 + 超时 + tool 角色
// 参考 cc-haha 的 services/api/client.ts 设计

import { getConfig, getApiBaseUrl, type CopilotConfig } from '../utils/config';

// ============ 消息类型 ============

export interface ApiMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | ApiContentBlock[];
    tool_call_id?: string;
    tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
    }>;
}

export interface ApiContentBlock {
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    content?: string | ApiContentBlock[];
    tool_use_id?: string;
    is_error?: boolean;
}

export interface ApiTool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

// ============ 流式事件 ============

export type StreamEvent =
    | { type: 'text_delta'; text: string }
    | { type: 'thinking'; text: string }
    | { type: 'tool_use_start'; id: string; name: string }
    | { type: 'tool_use_delta'; input_json_delta: string }
    | { type: 'tool_use_stop' }
    | { type: 'done' }
    | { type: 'error'; error: string };

// ============ API 调用 ============

const FETCH_TIMEOUT = 120_000; // 2 分钟

export async function fetchModels(config: CopilotConfig): Promise<string[]> {
    if (config.provider === 'ollama') {
        const resp = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) { throw new Error(`HTTP ${resp.status}`); }
        const data = await resp.json();
        return (data.models || []).map((m: any) => m.name);
    }
    const baseUrl = getApiBaseUrl(config);
    const resp = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) { throw new Error(`HTTP ${resp.status}`); }
    const data = await resp.json();
    return (data.data || []).map((m: any) => m.id);
}

// 流式聊天 - 支持 abort 信号
export async function* chatStream(
    messages: ApiMessage[],
    tools?: ApiTool[],
    overrides?: { model?: string; temperature?: number; maxTokens?: number; abortSignal?: AbortSignal }
): AsyncGenerator<StreamEvent, void, unknown> {
    const config = getConfig();
    const model = overrides?.model || config.chatModel;
    const temp = overrides?.temperature ?? config.temperature;
    const maxTokens = overrides?.maxTokens ?? config.maxTokens;
    const signal = overrides?.abortSignal;

    if (config.provider === 'ollama') {
        yield* chatStreamOllama(config, model, messages, temp, maxTokens, signal, tools);
    } else if (config.provider === 'anthropic') {
        yield* chatStreamAnthropic(config, model, messages, tools, temp, maxTokens, signal);
    } else {
        yield* chatStreamOpenAI(config, model, messages, tools, temp, maxTokens, signal);
    }
}

// ============ Ollama 流式 ============

async function* chatStreamOllama(
    config: CopilotConfig, model: string, messages: ApiMessage[],
    temperature: number, maxTokens: number, signal?: AbortSignal,
    tools?: ApiTool[]
): AsyncGenerator<StreamEvent> {
    const ollamaMessages = messages.map(m => {
        if (m.role === 'tool') {
            // 工具结果标记为 user，并加上前缀让模型理解这是工具返回值
            return {
                role: 'user' as const,
                content: `[工具结果: ${m.tool_call_id || 'tool'}]\n${typeof m.content === 'string' ? m.content : m.content.map(b => b.text || '').join('')}`,
            };
        }
        return {
            role: m.role === 'system' ? 'system' as const : m.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: typeof m.content === 'string' ? m.content : m.content.map(b => b.text || '').join(''),
        };
    });

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT);
    if (signal) { signal.addEventListener('abort', () => ac.abort()); }

    const body: Record<string, any> = {
        model, messages: ollamaMessages, stream: true,
        options: { temperature, num_predict: maxTokens },
    };
    // 关键：传递 tools 给 Ollama
    if (tools && tools.length > 0) {
        body.tools = tools.map(t => ({
            type: 'function',
            function: {
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters,
            },
        }));
    }

    try {
        const resp = await fetch(`${config.ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ac.signal,
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => 'unknown');
            yield { type: 'error', error: `Ollama HTTP ${resp.status}: ${errText}` };
            return;
        }

        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) { break; }
            if (ac.signal.aborted) { yield { type: 'error', error: '请求已取消' }; return; }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) { continue; }
                try {
                    const json = JSON.parse(trimmed);
                    // 文本内容
                    if (json.message?.content) {
                        yield { type: 'text_delta', text: json.message.content };
                    }
                    // Ollama 工具调用（在 message.tool_calls 中）
                    if (json.message?.tool_calls) {
                        for (const tc of json.message.tool_calls) {
                            const id = tc.id || `tc_${Date.now()}`;
                            const name = tc.function?.name || '';
                            const argsStr = typeof tc.function?.arguments === 'string'
                                ? tc.function.arguments
                                : JSON.stringify(tc.function?.arguments || {});
                            if (name) {
                                yield { type: 'tool_use_start', id, name };
                                yield { type: 'tool_use_delta', input_json_delta: argsStr };
                                yield { type: 'tool_use_stop' };
                            }
                        }
                    }
                    if (json.done) { yield { type: 'done' }; return; }
                } catch { /* skip partial JSON */ }
            }
        }
        yield { type: 'done' };
    } catch (e: any) {
        if (e.name === 'AbortError') {
            yield { type: 'error', error: ac.signal.aborted ? '请求已取消' : '请求超时' };
        } else {
            yield { type: 'error', error: `Ollama 连接失败: ${e.message}` };
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

// ============ OpenAI 兼容流式 ============

async function* chatStreamOpenAI(
    config: CopilotConfig, model: string, messages: ApiMessage[],
    tools: ApiTool[] | undefined, temperature: number, maxTokens: number, signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
    const baseUrl = getApiBaseUrl(config);

    // 转换消息格式
    const oaiMessages = messages.map(m => {
        if (typeof m.content === 'string') {
            return { role: m.role, content: m.content };
        }
        const textParts = m.content.filter(b => b.type === 'text').map(b => b.text || '');
        return { role: m.role, content: textParts.join('') || '' };
    });

    const body: Record<string, unknown> = {
        model, messages: oaiMessages, stream: true,
        temperature, max_tokens: maxTokens,
    };
    if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
    }

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT);
    if (signal) { signal.addEventListener('abort', () => ac.abort()); }

    try {
        const resp = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: ac.signal,
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => 'unknown');
            yield { type: 'error', error: `API Error ${resp.status}: ${errText}` };
            return;
        }

        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        // 累积 tool calls（与 agentLoop 的 currentToolCall 独立）
        const toolCallsAcc: Map<number, { id: string; name: string; args: string }> = new Map();

        while (true) {
            const { done, value } = await reader.read();
            if (done) { break; }
            if (ac.signal.aborted) { yield { type: 'error', error: '请求已取消' }; return; }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.replace(/^data: /, '').trim();
                if (!trimmed || trimmed === '[DONE]') { continue; }
                try {
                    const json = JSON.parse(trimmed);
                    const delta = json.choices?.[0]?.delta;
                    if (!delta) { continue; }

                    // 文本
                    if (delta.content) {
                        yield { type: 'text_delta', text: delta.content };
                    }

                    // 工具调用
                    if (delta.tool_calls) {
                        for (const tc of delta.tool_calls) {
                            const idx = tc.index ?? 0;
                            if (!toolCallsAcc.has(idx)) {
                                const id = tc.id || `tool_${Date.now()}_${idx}`;
                                const name = tc.function?.name || '';
                                toolCallsAcc.set(idx, { id, name, args: '' });
                                if (name) {
                                    yield { type: 'tool_use_start', id, name };
                                }
                            }
                            const existing = toolCallsAcc.get(idx)!;
                            if (tc.id) { existing.id = tc.id; }
                            if (tc.function?.name) { existing.name = tc.function.name; }
                            if (tc.function?.arguments) {
                                existing.args += tc.function.arguments;
                                yield { type: 'tool_use_delta', input_json_delta: tc.function.arguments };
                            }
                        }
                    }

                    const finish = json.choices?.[0]?.finish_reason;
                    if (finish === 'stop') {
                        yield { type: 'done' }; return;
                    }
                    if (finish === 'tool_calls') {
                        // 为每个累积的 tool call 发送 stop 事件
                        for (const [, tc] of toolCallsAcc) {
                            yield { type: 'tool_use_stop' };
                        }
                        yield { type: 'done' }; return;
                    }
                } catch { /* skip */ }
            }
        }
        yield { type: 'done' };
    } catch (e: any) {
        if (e.name === 'AbortError') {
            yield { type: 'error', error: ac.signal.aborted ? '请求已取消' : '请求超时' };
        } else {
            yield { type: 'error', error: `API 连接失败: ${e.message}` };
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

// ============ Anthropic 原生流式 ============

async function* chatStreamAnthropic(
    config: CopilotConfig, model: string, messages: ApiMessage[],
    tools: ApiTool[] | undefined, temperature: number, maxTokens: number, signal?: AbortSignal
): AsyncGenerator<StreamEvent> {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
        model, messages: nonSystemMsgs.map(m => ({
            role: m.role === 'tool' ? 'user' : m.role,
            content: typeof m.content === 'string' ? m.content : m.content,
        })),
        max_tokens: maxTokens, temperature, stream: true,
    };
    if (systemMsg) {
        body.system = typeof systemMsg.content === 'string' ? systemMsg.content : systemMsg.content.map(b => b.text || '').join('');
    }
    if (tools && tools.length > 0) {
        body.tools = tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
        }));
    }

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT);
    if (signal) { signal.addEventListener('abort', () => ac.abort()); }

    try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
            signal: ac.signal,
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => 'unknown');
            yield { type: 'error', error: `Anthropic API ${resp.status}: ${errText}` };
            return;
        }

        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentToolId = '';
        let currentToolName = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) { break; }
            if (ac.signal.aborted) { yield { type: 'error', error: '请求已取消' }; return; }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.replace(/^event: /, '').replace(/^data: /, '').trim();
                if (!trimmed) { continue; }
                try {
                    const json = JSON.parse(trimmed);

                    if (json.type === 'content_block_start') {
                        if (json.content_block?.type === 'text') {
                            // text block
                        } else if (json.content_block?.type === 'tool_use') {
                            currentToolId = json.content_block.id;
                            currentToolName = json.content_block.name;
                            yield { type: 'tool_use_start', id: currentToolId, name: currentToolName };
                        }
                    } else if (json.type === 'content_block_delta') {
                        if (json.delta?.type === 'text_delta') {
                            yield { type: 'text_delta', text: json.delta.text };
                        } else if (json.delta?.type === 'input_json_delta') {
                            yield { type: 'tool_use_delta', input_json_delta: json.delta.partial_json };
                        }
                    } else if (json.type === 'content_block_stop') {
                        if (currentToolName) {
                            yield { type: 'tool_use_stop' };
                            currentToolId = '';
                            currentToolName = '';
                        }
                    } else if (json.type === 'message_stop') {
                        yield { type: 'done' }; return;
                    } else if (json.type === 'error') {
                        yield { type: 'error', error: JSON.stringify(json.error) };
                        return;
                    }
                } catch { /* skip */ }
            }
        }
        yield { type: 'done' };
    } catch (e: any) {
        if (e.name === 'AbortError') {
            yield { type: 'error', error: ac.signal.aborted ? '请求已取消' : '请求超时' };
        } else {
            yield { type: 'error', error: `Anthropic 连接失败: ${e.message}` };
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

// ============ 工具定义构建 ============

export function buildToolDefs(tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>): ApiTool[] {
    return tools.map(t => ({
        type: 'function' as const,
        function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
        },
    }));
}
