import * as vscode from 'vscode';

export type ProviderType = 'ollama' | 'openai' | 'anthropic' | 'custom';

export interface CopilotConfig {
    provider: ProviderType;
    apiKey: string;
    apiBaseUrl: string;
    ollamaUrl: string;
    completionModel: string;
    chatModel: string;
    enableCompletion: boolean;
    completionDelay: number;
    maxTokens: number;
    temperature: number;
    contextLines: number;
    enableAutoTrigger: boolean;
    enableAgent: boolean;
    maxAgentTurns: number;
}

export function getConfig(): CopilotConfig {
    const cfg = vscode.workspace.getConfiguration('codeHelper');
    return {
        provider: cfg.get('provider', 'ollama'),
        apiKey: cfg.get('apiKey', ''),
        apiBaseUrl: cfg.get('apiBaseUrl', ''),
        ollamaUrl: cfg.get('ollamaUrl', 'http://localhost:11434'),
        completionModel: cfg.get('completionModel', 'qwen2.5-coder:3b'),
        chatModel: cfg.get('chatModel', 'qwen2.5:3b'),
        enableCompletion: cfg.get('enableCompletion', true),
        completionDelay: cfg.get('completionDelay', 300),
        maxTokens: cfg.get('maxTokens', 8192),
        temperature: cfg.get('temperature', 0.2),
        contextLines: cfg.get('contextLines', 100),
        enableAutoTrigger: cfg.get('enableAutoTrigger', true),
        enableAgent: cfg.get('enableAgent', true),
        maxAgentTurns: cfg.get('maxAgentTurns', 20),
    };
}

export function getApiBaseUrl(config: CopilotConfig): string {
    switch (config.provider) {
        case 'ollama': return config.ollamaUrl;
        case 'openai': return 'https://api.openai.com/v1';
        case 'anthropic': return 'https://api.anthropic.com/v1';
        case 'custom': return config.apiBaseUrl.replace(/\/+$/, '');
        default: return config.ollamaUrl;
    }
}
