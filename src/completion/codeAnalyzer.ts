// 实时代码分析器 v5.0 - 双触发器
// 触发1: 光标位置改变 (1200ms 防抖)
// 触发2: 文本内容改变 (500ms 防抖)
// Tab 接受建议，Esc 拒绝建议

import * as vscode from 'vscode';
import { getConfig } from '../utils/config';
import { chatStream } from '../models/apiClient';

export interface Suggestion {
    removedLines: string[];
    addedLines: string[];
    reason: string;
}

// 全局建议状态
let currentSuggestion: Suggestion | null = null;
let suggestionLine = -1;
let suggestionEditor: vscode.TextEditor | null = null;
let originalLineText = '';
let acceptingSuggestion = false; // 防止接受建议时重新触发分析

export function getCurrentSuggestion(): Suggestion | null { return currentSuggestion; }

// 装饰器类型
let beforeDeco: vscode.TextEditorDecorationType;
let afterDeco: vscode.TextEditorDecorationType;

export function initDecorations(): void {
    beforeDeco = vscode.window.createTextEditorDecorationType({ isWholeLine: true });
    afterDeco = vscode.window.createTextEditorDecorationType({ isWholeLine: true });
}

export function disposeDecorations(): void {
    beforeDeco?.dispose();
    afterDeco?.dispose();
}

export class CodeAnalyzer implements vscode.Disposable {
    private cursorDebounce: ReturnType<typeof setTimeout> | undefined;
    private editDebounce: ReturnType<typeof setTimeout> | undefined;
    private abortController: AbortController | undefined;
    private lastLine = -1;
    private lastUri = '';
    private lastContent = '';
    private disposables: vscode.Disposable[] = [];

    constructor() {
        // 触发1: 光标选择改变
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection(e => this.onSelectionChange(e))
        );
        // 触发2: 文本内容改变
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChange(e))
        );
        // 切换编辑器时清除
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.clearSuggestions())
        );
    }

    // 触发1: 光标移动
    private onSelectionChange(e: vscode.TextEditorSelectionChangeEvent): void {
        if (acceptingSuggestion) { return; }
        const editor = e.textEditor;
        const line = e.selections[0].active.line;
        const uri = editor.document.uri.toString();

        if (line === this.lastLine && uri === this.lastUri) { return; }

        this.abortPending();
        this.clearSuggestions();
        this.lastLine = line;
        this.lastUri = uri;

        const lineText = editor.document.lineAt(line).text.trim();
        if (!lineText) { return; }

        // 记录内容用于 edit 触发器对比
        this.lastContent = editor.document.getText();

        // 1200ms 防抖
        if (this.cursorDebounce) { clearTimeout(this.cursorDebounce); }
        this.cursorDebounce = setTimeout(() => this.analyzeLine(editor, line), 1200);
    }

    // 触发2: 文本编辑
    private onDocumentChange(e: vscode.TextDocumentChangeEvent): void {
        if (acceptingSuggestion) { return; }
        const editor = vscode.window.activeTextEditor;
        if (!editor || e.document.uri.toString() !== editor.document.uri.toString()) { return; }

        const newContent = editor.document.getText();
        if (newContent === this.lastContent) { return; }
        this.lastContent = newContent;

        // 清除旧建议（内容已变）
        this.clearSuggestions();

        const line = editor.selection.active.line;
        const lineText = editor.document.lineAt(line).text.trim();
        if (!lineText) { return; }

        // 500ms 防抖（比光标移动更短）
        if (this.editDebounce) { clearTimeout(this.editDebounce); }
        this.editDebounce = setTimeout(() => {
            this.lastLine = line;
            this.lastUri = editor.document.uri.toString();
            this.analyzeLine(editor, line);
        }, 500);
    }

    private abortPending(): void {
        this.abortController?.abort();
        this.abortController = undefined;
        if (this.cursorDebounce) { clearTimeout(this.cursorDebounce); }
        if (this.editDebounce) { clearTimeout(this.editDebounce); }
    }

    private async analyzeLine(editor: vscode.TextEditor, line: number): Promise<void> {
        const config = getConfig();
        if (!config.enableCompletion) {
            console.log('[CodeAnalyzer] 代码补全已禁用');
            return;
        }

        console.log('[CodeAnalyzer] 开始分析第', line + 1, '行, 模型:', config.completionModel);
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            const doc = editor.document;
            const fullText = doc.getText();
            const currentLine = doc.lineAt(line).text;
            const lang = doc.languageId;
            const file = doc.fileName.split(/[/\\]/).pop() || '';
            const ln = line + 1;

            const prompt = `分析代码第${ln}行是否有错误或可优化之处。只关注这一行。

文件: ${file}  语言: ${lang}
\`\`\`
${fullText}
\`\`\`
第${ln}行: ${currentLine}

严格按此格式回复:
如有建议:
SUGGESTION_START
- ${currentLine}
+ 修正后的代码
REASON: 原因
SUGGESTION_END

如无建议:
NO_SUGGESTION`;

            let resp = '';
            for await (const ev of chatStream(
                [{ role: 'user', content: prompt }], undefined,
                { model: config.completionModel, temperature: 0.1, maxTokens: 256 }
            )) {
                if (signal.aborted) { return; }
                if (ev.type === 'text_delta') { resp += ev.text; }
                if (ev.type === 'error') { return; }
            }

            if (signal.aborted) { return; }

            console.log('[CodeAnalyzer] AI 响应:', resp.substring(0, 200));
            const suggestion = this.parse(resp);
            if (suggestion && suggestion.addedLines.length > 0) {
                console.log('[CodeAnalyzer] 显示建议:', suggestion.addedLines.length, '行');
                currentSuggestion = suggestion;
                suggestionLine = line;
                suggestionEditor = editor;
                originalLineText = editor.document.lineAt(line).text;
                this.showDecorations(editor, line, suggestion);
                vscode.commands.executeCommand('setContext', 'codeHelperSuggestionActive', true);
            } else {
                console.log('[CodeAnalyzer] 无建议');
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') { console.error('[CodeAnalyzer]', e); }
        }
    }

    private parse(resp: string): Suggestion | null {
        if (resp.includes('NO_SUGGESTION')) { return null; }
        const m = resp.match(/SUGGESTION_START\s*\n([\s\S]*?)\s*SUGGESTION_END/);
        if (!m) { return null; }
        const removed: string[] = [];
        const added: string[] = [];
        for (const l of m[1].split('\n')) {
            if (l.startsWith('- ')) { removed.push(l.substring(2)); }
            else if (l.startsWith('+ ')) { added.push(l.substring(2)); }
        }
        const rm = resp.match(/REASON:\s*(.+)/);
        if (removed.length === 0 && added.length === 0) { return null; }
        return { removedLines: removed, addedLines: added, reason: rm?.[1]?.trim() || '' };
    }

    private showDecorations(editor: vscode.TextEditor, line: number, s: Suggestion): void {
        editor.setDecorations(beforeDeco, []);
        editor.setDecorations(afterDeco, []);

        const lineText = editor.document.lineAt(line).text;
        const indent = lineText.match(/^\s*/)?.[0] || '';

        const parts: string[] = [];
        for (const r of s.removedLines) { parts.push(`  − ${r}`); }
        for (const a of s.addedLines) { parts.push(`  + ${a}`); }
        const beforeText = indent + parts.join('\n');

        const range = new vscode.Range(line, 0, line, lineText.length);

        editor.setDecorations(beforeDeco, [{
            range,
            renderOptions: {
                before: {
                    contentText: beforeText,
                    color: '#eee',
                    backgroundColor: 'rgba(40, 80, 40, 0.85)',
                    fontStyle: 'normal',
                    margin: '0 0 0 16px',
                    border: '1px solid #4a8',
                    borderRadius: '3px',
                    padding: '1px 6px',
                },
            },
        }]);

        if (s.reason) {
            editor.setDecorations(afterDeco, [{
                range,
                renderOptions: {
                    after: {
                        contentText: `  💡 ${s.reason}`,
                        color: '#9a9',
                        fontStyle: 'italic',
                        margin: '0 0 0 8px',
                    },
                },
            }]);
        }
    }

    private clearSuggestions(): void {
        if (currentSuggestion) {
            currentSuggestion = null;
            suggestionLine = -1;
            originalLineText = '';
            suggestionEditor?.setDecorations(beforeDeco, []);
            suggestionEditor?.setDecorations(afterDeco, []);
            suggestionEditor = null;
            vscode.commands.executeCommand('setContext', 'codeHelperSuggestionActive', false);
        }
    }

    dispose(): void {
        this.abortPending();
        for (const d of this.disposables) { d.dispose(); }
        this.clearSuggestions();
    }
}

// ============ 全局命令 ============

export function acceptSuggestion(): void {
    const suggestion = currentSuggestion;
    const editor = suggestionEditor;
    const line = suggestionLine;

    if (!suggestion || !editor || line < 0) { return; }
    if (editor.document.isClosed) { return; }

    acceptingSuggestion = true;
    const newCode = suggestion.addedLines.join('\n');
    const doc = editor.document;
    if (line >= doc.lineCount) { return; }

    const lineRange = doc.lineAt(line).range;
    editor.edit(edit => {
        edit.replace(lineRange, newCode);
    }).then(success => {
        acceptingSuggestion = false;
        if (success) {
            vscode.window.showInformationMessage('✅ 已应用建议');
        }
        clearAllSuggestions();
    });
}

export function rejectSuggestion(): void {
    clearAllSuggestions();
}

function clearAllSuggestions(): void {
    currentSuggestion = null;
    suggestionLine = -1;
    originalLineText = '';
    suggestionEditor?.setDecorations(beforeDeco, []);
    suggestionEditor?.setDecorations(afterDeco, []);
    suggestionEditor = null;
    vscode.commands.executeCommand('setContext', 'codeHelperSuggestionActive', false);
}
