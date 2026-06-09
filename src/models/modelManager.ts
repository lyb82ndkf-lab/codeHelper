// 模型管理器

import * as vscode from 'vscode';
import { fetchModels, checkHealth } from './apiClient';
import { getConfig } from '../utils/config';

export class ModelManager {
    private models: string[] = [];
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'codeHelper.switchModel';
        this.statusBarItem.tooltip = '点击切换模型';
        this.statusBarItem.show();
    }

    async initialize(): Promise<void> {
        const config = getConfig();
        const isOnline = await checkHealth(config);
        if (!isOnline) {
            this.statusBarItem.text = '$(warning) AI 未连接';
            this.statusBarItem.command = 'codeHelper.refreshModels';
            return;
        }
        await this.refreshModels();
    }

    async refreshModels(): Promise<void> {
        const config = getConfig();
        try {
            this.models = await fetchModels(config);
            if (!this.models.length) { this.statusBarItem.text = '$(warning) 无模型'; return; }
            this.updateStatus();
        } catch (e: any) {
            vscode.window.showErrorMessage(`获取模型失败: ${e.message}`);
            this.statusBarItem.text = '$(error) 连接失败';
        }
    }

    async switchModel(): Promise<void> {
        if (!this.models.length) { vscode.window.showWarningMessage('没有可用模型'); return; }
        const sel = await vscode.window.showQuickPick(
            this.models.map(m => ({ label: m, picked: m === this.statusBarItem.text.split(' ').pop() })),
            { placeHolder: '选择聊天模型', title: 'CodeHelper - 切换模型' }
        );
        if (sel) { vscode.workspace.getConfiguration('codeHelper').update('chatModel', sel.label, vscode.ConfigurationTarget.Global); this.updateStatus(); }
    }

    async switchCompletionModel(): Promise<void> {
        if (!this.models.length) { vscode.window.showWarningMessage('没有可用模型'); return; }
        const sel = await vscode.window.showQuickPick(
            this.models.map(m => ({ label: m })),
            { placeHolder: '选择补全模型', title: 'CodeHelper - 切换补全模型' }
        );
        if (sel) { vscode.workspace.getConfiguration('codeHelper').update('completionModel', sel.label, vscode.ConfigurationTarget.Global); }
    }

    async switchProvider(): Promise<void> {
        const items = [
            { label: 'ollama', description: '本地 Ollama 服务' },
            { label: 'openai', description: 'OpenAI 官方 API' },
            { label: 'anthropic', description: 'Anthropic Claude API' },
            { label: 'custom', description: '自定义 OpenAI 兼容地址' },
        ];
        const sel = await vscode.window.showQuickPick(items, { placeHolder: '选择服务提供商', title: 'CodeHelper - 切换 Provider' });
        if (sel) {
            await vscode.workspace.getConfiguration('codeHelper').update('provider', sel.label, vscode.ConfigurationTarget.Global);
            this.updateStatus();
        }
    }

    async toggleAgent(): Promise<void> {
        const cfg = vscode.workspace.getConfiguration('codeHelper');
        await cfg.update('enableAgent', !cfg.get('enableAgent'), vscode.ConfigurationTarget.Global);
    }

    async toggleCompletion(): Promise<void> {
        const cfg = vscode.workspace.getConfiguration('codeHelper');
        await cfg.update('enableCompletion', !cfg.get('enableCompletion'), vscode.ConfigurationTarget.Global);
    }

    private updateStatus(): void {
        const config = getConfig();
        const icon = config.provider === 'ollama' ? '$(database)' : '$(cloud)';
        this.statusBarItem.text = `${icon} ${config.chatModel}`;
    }

    getModels(): string[] { return this.models; }
    dispose(): void { this.statusBarItem.dispose(); }
}
