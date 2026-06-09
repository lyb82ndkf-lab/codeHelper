// 聊天历史管理

import type { ApiMessage } from '../models/apiClient';

export interface Conversation {
    id: string;
    title: string;
    messages: ApiMessage[];
    createdAt: number;
    mode: 'chat' | 'agent'; // 普通聊天 or Agent 工具模式
}

export class ChatHistory {
    private conversations: Conversation[] = [];
    private currentId: string = '';

    constructor() {
        this.newConversation('chat');
    }

    newConversation(mode: 'chat' | 'agent' = 'chat'): string {
        const id = `conv_${Date.now()}`;
        this.conversations.unshift({
            id,
            title: '新对话',
            messages: [{ role: 'system', content: '' }],
            createdAt: Date.now(),
            mode,
        });
        this.currentId = id;
        return id;
    }

    getCurrent(): Conversation {
        return this.conversations.find(c => c.id === this.currentId) || this.conversations[0];
    }

    addMessage(msg: ApiMessage): void {
        const conv = this.getCurrent();
        if (msg.role === 'user' && conv.messages.filter(m => m.role === 'user').length === 0) {
            const text = typeof msg.content === 'string' ? msg.content : '';
            conv.title = text.length > 40 ? text.substring(0, 40) + '...' : text;
        }
        conv.messages.push(msg);
    }

    setMessages(msgs: ApiMessage[]): void {
        const conv = this.getCurrent();
        conv.messages = msgs;
    }

    getMessages(): ApiMessage[] {
        return this.getCurrent().messages;
    }

    switchTo(id: string): boolean {
        if (this.conversations.find(c => c.id === id)) {
            this.currentId = id;
            return true;
        }
        return false;
    }

    getAll(): Conversation[] {
        return this.conversations;
    }
}
