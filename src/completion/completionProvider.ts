// CompletionProvider v7.0 - 简洁版，低 GPU 占用
// 纯 FIM 补全，不做额外处理

import * as vscode from 'vscode';
import { getConfig } from '../utils/config';
import { logCompletionRequest, logCompletionResponse, logCompletionError, logCompletionSkip, logInfo } from '../utils/logger';

function cleanCompletion(text: string): string {
    if (!text) return '';
    text = text.replace(/<\|fim_(?:prefix|suffix|middle|end)\|>/g, '').trim();
    const firstLine = text.split('\n')[0] || '';
    return firstLine.replace(/^```[\w]*\s*/, '').replace(/```$/, '').trim();
}

export class CompletionProvider implements vscode.InlineCompletionItemProvider {
    private abortCtrl: AbortController | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private requestCounter = 0;
    private callCounter = 0;

    provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.InlineCompletionItem[]> {
        const callId = ++this.callCounter;
        const config = getConfig();

        if (!config.enableCompletion) return [];

        // 手动触发时无缓存
        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke) return [];

        // 跳过空行
        const line = document.lineAt(position.line).text;
        if (!line.trim() && position.line === 0) return [];

        // 防抖 + 取消旧请求
        if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
        if (this.abortCtrl) { this.abortCtrl.abort(); this.abortCtrl = undefined; }

        const requestId = ++this.requestCounter;

        return new Promise(resolve => {
            this.timer = setTimeout(async () => {
                const startTime = Date.now();
                const ac = new AbortController();
                this.abortCtrl = ac;
                const disposable = token.onCancellationRequested(() => ac.abort());

                try {
                    // 取上下文：光标前85%，后15%
                    const ctx = config.contextLines || 100;
                    const nPre = Math.floor(ctx * 0.85);
                    const nSuf = Math.floor(ctx * 0.15);
                    const sLine = Math.max(0, position.line - nPre);
                    const eLine = Math.min(document.lineCount - 1, position.line + nSuf);

                    const prefix = document.getText(new vscode.Range(sLine, 0, position.line, position.character));
                    const suffix = document.getText(new vscode.Range(position.line, position.character, eLine, 0));

                    if (!prefix.trim()) { resolve(undefined); return; }

                    logCompletionRequest(requestId, config.completionModel, prefix.length, suffix.length, document.languageId, document.fileName.split(/[/\\]/).pop() || '');

                    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';

                    // 纯净 FIM prompt
                    const fimPrompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;

                    const resp = await fetch(`${ollamaUrl}/api/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: config.completionModel,
                            prompt: fimPrompt,
                            stream: false,
                            options: { temperature: 0.1, num_predict: 128 },
                        }),
                        signal: ac.signal,
                    });

                    if (!resp.ok) {
                        logCompletionError(requestId, `HTTP ${resp.status}`);
                        resolve(undefined);
                        return;
                    }

                    const data = await resp.json() as { response?: string; error?: string };
                    if (data.error) {
                        logCompletionError(requestId, data.error);
                        resolve(undefined);
                        return;
                    }

                    const completion = cleanCompletion(data.response || '');
                    const duration = Date.now() - startTime;

                    logCompletionResponse(requestId, (data.response || '').length, completion, duration);

                    if (!completion || completion.length < 2) {
                        logCompletionSkip(requestId, 'empty');
                        resolve(undefined);
                        return;
                    }

                    resolve([{ insertText: completion, range: new vscode.Range(position, position) }]);
                } catch (e: any) {
                    if (e.name !== 'AbortError') logCompletionError(requestId, e.message);
                    resolve(undefined);
                } finally {
                    disposable.dispose();
                }
            }, config.completionDelay || 500);

            token.onCancellationRequested(() => {
                if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
                resolve(undefined);
            });
        });
    }

    dispose(): void {
        if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
        this.abortCtrl?.abort();
    }
}
