// Agent 核心类型定义，参考 cc-haha 的 Tool.ts 和 query.ts

// ============ 工具定义 ============

export interface AgentTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    call(args: Record<string, unknown>): Promise<string>;
    isReadOnly?(args: Record<string, unknown>): boolean;
}

// ============ 对话消息 ============

export interface AgentMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: string;
}

// ============ Agent 状态 ============

export type AgentEventType =
    | { type: 'text_delta'; text: string }
    | { type: 'tool_use'; name: string; args: Record<string, unknown> }
    | { type: 'tool_result'; name: string; result: string; isError?: boolean }
    | { type: 'thinking'; text: string }
    | { type: 'done'; messageCount: number }
    | { type: 'error'; error: string }
    | { type: 'turn_start'; turn: number }
    | { type: 'aborted' };

export interface AgentConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    maxTurns: number;
    enableTools: boolean;
}
