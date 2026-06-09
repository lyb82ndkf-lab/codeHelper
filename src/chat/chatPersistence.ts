// 聊天记录持久化 - 保存到 .codeHelper/ 目录

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { ApiMessage } from '../models/apiClient';

export interface ChatSession {
    id: string;
    title: string;
    messages: ApiMessage[];
    createdAt: number;
    mode: 'chat' | 'agent';
}

function getStorageDir(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) { return null; }
    const dir = path.join(folders[0].uri.fsPath, '.codeHelper');
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    return dir;
}

function getSessionsFile(): string | null {
    const dir = getStorageDir();
    return dir ? path.join(dir, 'chatHistory.json') : null;
}

export function loadSessions(): ChatSession[] {
    const file = getSessionsFile();
    if (!file || !fs.existsSync(file)) { return []; }
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}

export function saveSessions(sessions: ChatSession[]): void {
    const file = getSessionsFile();
    if (!file) { return; }
    fs.writeFileSync(file, JSON.stringify(sessions.slice(0, 100), null, 2), 'utf-8');
}

export function createSession(mode: 'chat' | 'agent' = 'chat'): ChatSession {
    const session: ChatSession = {
        id: `s_${Date.now()}`, title: '新对话', messages: [],
        createdAt: Date.now(), mode,
    };
    const sessions = loadSessions();
    sessions.unshift(session);
    saveSessions(sessions);
    return session;
}

export function addMessageToSession(sessionId: string, role: 'user' | 'assistant', content: string, inMemorySession?: ChatSession): void {
    // 同时更新内存中的 session（如果传入了引用）
    if (inMemorySession && inMemorySession.id === sessionId) {
        inMemorySession.messages.push({ role, content });
    }
    // 持久化到磁盘
    const sessions = loadSessions();
    const s = sessions.find(x => x.id === sessionId);
    if (!s) { return; }
    s.messages.push({ role, content });
    if (role === 'user' && s.messages.filter(m => m.role === 'user').length === 1) {
        s.title = content.length > 40 ? content.substring(0, 40) + '...' : content;
    }
    saveSessions(sessions);
}

export function deleteSession(id: string): void {
    saveSessions(loadSessions().filter(s => s.id !== id));
}
