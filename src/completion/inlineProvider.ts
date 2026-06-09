// 代码补全 v0.6.0
// 在光标下方新起一行显示建议代码，Tab 接受，Esc 拒绝

import * as vscode from 'vscode';
import { getConfig } from '../utils/config';
import { chatStream } from '../models/apiClient';
import { buildCompletionPrompt } from './promptBuilder';

export function initDecorations(): void { /* 不再需要装饰器 */ }
export function disposeDecorations(): void { /* 不再需要装饰器 */ }

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private debounceTimer: ReturnType<typeof setTimeout> | undefined;
    private abortController: AbortController | undefined;

    provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.InlineCompletionItem[] | vscode.InlineCompletionList> {
        const config = getConfig();
        if (!config.enableCompletion) { return []; }
        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic && !config.enableAutoTrigger) { return []; }

        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke) {
            return this.doComplete(document, position, token);
        }

        return new Promise(resolve => {
            if (this.debounceTimer) { clearTimeout(this.debounceTimer); }
            this.debounceTimer = setTimeout(async () => {
                resolve(await this.doComplete(document, position, token));
            }, config.completionDelay);
        });
    }

    private async doComplete(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[]> {
        const config = getConfig();
        if (this.abortController) { this.abortController.abort(); }
        this.abortController = new AbortController();
        const disposable = token.onCancellationRequested(() => this.abortController?.abort());

        try {
            // 构建上下文：光标前的代码
            const startLine = Math.max(0, position.line - config.contextLines);
            const prefix = document.getText(new vscode.Range(startLine, 0, position.line, position.character));
            const suffix = document.getText(new vscode.Range(position.line, position.character, position.line + 50, 0));

            const prompt = buildCompletionPrompt({
                language: document.languageId,
                fileName: document.fileName.split(/[/\\]/).pop() || 'unknown',
                prefix, suffix,
            });

            let full = '';
            for await (const event of chatStream(
                [{ role: 'user', content: prompt }],
                undefined,
                { model: config.completionModel, temperature: 0.2, maxTokens: 512 }
            )) {
                if (token.isCancellationRequested || this.abortController.signal.aborted) { break; }
                if (event.type === 'text_delta') { full += event.text; }
                if (event.type === 'error') { break; }
            }

            // 清理响应
            let completion = full.trim()
                .replace(/^```[\w]*\n?/gm, '')
                .replace(/```$/gm, '')
                .trim();

            for (const p of ['补全:', '补全：', 'Completion:']) {
                if (completion.startsWith(p)) { completion = completion.slice(p.length).trim(); }
            }

            if (!completion) { return []; }

            // 在光标**下方新起一行**显示建议代码
            // range 设置为光标位置到光标位置，insertText 会在光标处插入
            // 但我们需要让它显示在下一行，所以用 range 覆盖光标到行尾
            const lineEnd = new vscode.Position(position.line, document.lineAt(position.line).text.length);
            const range = new vscode.Range(position, lineEnd);

            return [{
                insertText: '\n' + completion,
                range: range,
            }];
        } catch {
            return [];
        } finally {
            disposable.dispose();
        }
    }

    dispose(): void {
        this.debounceTimer && clearTimeout(this.debounceTimer);
        this.abortController?.abort();
    }
}
