// 左侧配置面板 v0.4.0 - 美观分组设计

import * as vscode from 'vscode';
import { getConfig } from '../utils/config';

interface ConfigItem extends vscode.TreeItem {
    contextValue: string;
}

export class ConfigTreeView implements vscode.TreeDataProvider<ConfigItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ConfigItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void { this._onDidChangeTreeData.fire(undefined); }
    getTreeItem(el: ConfigItem): vscode.TreeItem { return el; }

    getChildren(): ConfigItem[] {
        const cfg = getConfig();
        const items: ConfigItem[] = [];

        // ===== 服务配置 =====
        const provLabels: Record<string, string> = {
            ollama: 'Ollama (本地)', openai: 'OpenAI',
            anthropic: 'Anthropic Claude', custom: '自定义 API',
        };
        items.push(this.makeGroup('⚙️ 服务配置'));

        const provItem = this.makeItem(
            `提供商: ${provLabels[cfg.provider]}`,
            '点击切换服务提供商',
            'cloud',
        );
        provItem.command = { command: 'codeHelper.switchProvider', title: '切换 Provider' };
        items.push(provItem);

        const modelItem = this.makeItem(
            `聊天模型: ${cfg.chatModel}`,
            '用于对话和 Agent 模式',
            'symbol-misc',
        );
        modelItem.command = { command: 'codeHelper.switchModel', title: '切换模型' };
        items.push(modelItem);

        const compModelItem = this.makeItem(
            `补全模型: ${cfg.completionModel}`,
            '用于代码自动补全',
            'code',
        );
        compModelItem.command = { command: 'codeHelper.switchCompletionModel', title: '切换补全模型' };
        items.push(compModelItem);

        const hasKey = !!cfg.apiKey;
        const isOllama = cfg.provider === 'ollama';
        const keyItem = this.makeItem(
            isOllama ? 'API Key: 不需要' : (hasKey ? 'API Key: ✓ 已配置' : 'API Key: ✗ 未配置'),
            isOllama ? 'Ollama 无需 API Key' : (hasKey ? '已配置 API Key' : '点击配置 API Key'),
            hasKey || isOllama ? 'key' : 'warning',
        );
        if (!hasKey && !isOllama) {
            keyItem.command = { command: 'codeHelper.openSettings', title: '打开设置' };
        }
        items.push(keyItem);

        // ===== 功能开关 =====
        items.push(this.makeGroup('🔧 功能开关'));

        const agentItem = this.makeItem(
            `Agent 模式: ${cfg.enableAgent ? '✓ 开启' : '✗ 关闭'}`,
            cfg.enableAgent ? 'AI 可读写文件、执行命令' : '仅聊天模式',
            cfg.enableAgent ? 'check' : 'x',
        );
        agentItem.command = { command: 'codeHelper.toggleAgent', title: '切换 Agent' };
        items.push(agentItem);

        const compItem = this.makeItem(
            `自动补全: ${cfg.enableCompletion ? '✓ 开启' : '✗ 关闭'}`,
            cfg.enableCompletion ? '输入时自动触发补全' : '仅手动触发',
            cfg.enableCompletion ? 'check' : 'x',
        );
        compItem.command = { command: 'codeHelper.toggleCompletion', title: '切换补全' };
        items.push(compItem);

        // ===== 快捷操作 =====
        items.push(this.makeGroup('🚀 快捷操作'));

        const chatItem = this.makeItem('打开聊天面板', '在右侧打开 AI 聊天', 'comment-discussion');
        chatItem.command = { command: 'codeHelper.openChat', title: '打开聊天' };
        items.push(chatItem);

        const refreshItem = this.makeItem('刷新模型列表', '重新获取可用模型', 'refresh');
        refreshItem.command = { command: 'codeHelper.refreshModels', title: '刷新模型' };
        items.push(refreshItem);

        const settingsItem = this.makeItem('高级设置', '打开完整设置页面', 'gear');
        settingsItem.command = { command: 'codeHelper.openSettings', title: '打开设置' };
        items.push(settingsItem);

        return items;
    }

    private makeGroup(label: string): ConfigItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'group';
        item.iconPath = new vscode.ThemeIcon('folder');
        item.description = '';
        return item;
    }

    private makeItem(label: string, desc: string, icon: string): ConfigItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'item';
        item.iconPath = new vscode.ThemeIcon(icon);
        item.description = desc;
        return item;
    }
}
