// CodeHelper v1.3.0 - Ported twinny patterns
// Sidebar: WebviewView (twinny-style registration)
// Completion: InlineCompletionItemProvider with FIM
// Chat: WebviewView with streaming

import * as vscode from 'vscode';
import { ChatViewProvider } from './chat/chatViewProvider';
import { CompletionProvider } from './completion/completionProvider';
import { buildDiagnosePrompt } from './tools/diagnosticTool';
import { initLogger, getLogDir } from './utils/logger';

let chatProvider: ChatViewProvider | undefined;
let completionProvider: CompletionProvider | undefined;

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
    console.log('[CodeHelper] v1.3.0 activated');
    initLogger(ctx.extensionUri);
    console.log('[CodeHelper] Logs →', getLogDir());

    // Chat panel (WebviewView in sidebar - twinny pattern)
    chatProvider = new ChatViewProvider(ctx.extensionUri);
    ctx.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatViewProvider.viewType,
            chatProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // FIM completion provider (twinny-style)
    completionProvider = new CompletionProvider();
    ctx.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**' },
            completionProvider
        )
    );

    // Commands
    ctx.subscriptions.push(vscode.commands.registerCommand('codeHelper.openChat', () => {
        vscode.commands.executeCommand('codeHelper.chatView.focus');
    }));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeHelper.acceptCompletion', () => completionProvider?.acceptCompletion()));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeHelper.rejectCompletion', () => completionProvider?.rejectCompletion()));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeHelper.acceptSuggestion', () => completionProvider?.acceptCompletion()));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeHelper.rejectSuggestion', () => completionProvider?.rejectCompletion()));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeHelper.newChat', () => chatProvider?.newChat()));

    // Right-click actions
    for (const [id, action] of [
        ['codeHelper.explainCode', 'explain'],
        ['codeHelper.fixCode', 'fix'],
        ['codeHelper.optimizeCode', 'optimize'],
        ['codeHelper.addComments', 'comment'],
    ] as const) {
        ctx.subscriptions.push(vscode.commands.registerCommand(id, async () => {
            const ed = vscode.window.activeTextEditor;
            if (!ed || ed.selection.isEmpty) {
                vscode.window.showWarningMessage('Select code first');
                return;
            }
            const code = ed.document.getText(ed.selection);
            await chatProvider?.executeAction(action, code);
        }));
    }

    ctx.subscriptions.push(vscode.commands.registerCommand('codeHelper.diagnoseError', async () => {
        await chatProvider?.sendDiagnosticMessage(buildDiagnosePrompt());
    }));

    console.log('[CodeHelper] commands registered');
}

export function deactivate(): void {
    chatProvider?.dispose();
    completionProvider?.dispose();
}
