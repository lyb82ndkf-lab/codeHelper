// Activity bar welcome view - 点击打开聊天面板

import * as vscode from 'vscode';

export class WelcomeTreeView implements vscode.TreeDataProvider<WelcomeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<WelcomeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: WelcomeItem): vscode.TreeItem {
        return element;
    }

    getChildren(): WelcomeItem[] {
        return [
            new WelcomeItem('打开聊天面板', '点击打开 AI 聊天', 'codeHelper.openChat', '💬'),
            new WelcomeItem('新建对话', '开始新的对话', 'codeHelper.newChat', '📝'),
        ];
    }
}

class WelcomeItem extends vscode.TreeItem {
    constructor(label: string, desc: string, command: string, icon: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = desc;
        this.iconPath = new vscode.ThemeIcon(icon.replace(/[^\w]/g, ''));
        this.command = { command, title: '' };
    }
}
