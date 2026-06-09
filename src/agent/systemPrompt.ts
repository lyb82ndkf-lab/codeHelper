// System Prompt v1.1 - Agent MUST use tools, not just explain

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const MAX_INSTRUCTION_FILE_CHARS = 4000;
const MAX_TOTAL_INSTRUCTION_CHARS = 12000;

const INSTRUCTION_FILE_NAMES = [
    'CLAUDE.md', 'CLAW.md', 'AGENTS.md', 'CLAUDE.local.md',
    '.claude/CLAUDE.md', '.claw/CLAUDE.md', '.claw/instructions.md',
];

const INSTRUCTION_DIR_NAMES = [
    '.claude/rules', '.claw/rules', '.claw/rules.local',
];

function discoverInstructionFiles(workspacePath: string): string[] {
    const files: string[] = [];
    let totalChars = 0;
    for (const name of INSTRUCTION_FILE_NAMES) {
        const filePath = path.join(workspacePath, name);
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8').substring(0, MAX_INSTRUCTION_FILE_CHARS);
                if (content.trim()) {
                    files.push(`# ${name}\n${content}`);
                    totalChars += content.length;
                    if (totalChars >= MAX_TOTAL_INSTRUCTION_CHARS) break;
                }
            } catch { /* skip */ }
        }
    }
    for (const dirName of INSTRUCTION_DIR_NAMES) {
        const dirPath = path.join(workspacePath, dirName);
        if (fs.existsSync(dirPath)) {
            try {
                const entries = fs.readdirSync(dirPath);
                for (const entry of entries) {
                    if (/\.(md|txt|mdc)$/.test(entry)) {
                        const filePath = path.join(dirPath, entry);
                        try {
                            const content = fs.readFileSync(filePath, 'utf-8').substring(0, MAX_INSTRUCTION_FILE_CHARS);
                            if (content.trim()) {
                                files.push(`# ${dirName}/${entry}\n${content}`);
                                totalChars += content.length;
                                if (totalChars >= MAX_TOTAL_INSTRUCTION_CHARS) break;
                            }
                        } catch { /* skip */ }
                    }
                }
            } catch { /* skip */ }
        }
        if (totalChars >= MAX_TOTAL_INSTRUCTION_CHARS) break;
    }
    return files;
}

function getGitContext(workspacePath: string): string {
    const parts: string[] = [];
    try {
        const status = execSync('git status --short', { cwd: workspacePath, encoding: 'utf-8', timeout: 3000 });
        if (status.trim()) parts.push(`Git Status:\n${status.trim()}`);
    } catch { /* skip */ }
    try {
        const log = execSync('git log --oneline -5', { cwd: workspacePath, encoding: 'utf-8', timeout: 3000 });
        if (log.trim()) parts.push(`Recent Commits:\n${log.trim()}`);
    } catch { /* skip */ }
    return parts.join('\n\n');
}

export function buildSystemPrompt(workspacePath: string): string {
    const editor = vscode.window.activeTextEditor;
    const language = editor?.document.languageId || 'unknown';
    const fileName = editor?.document.fileName?.split(/[/\\]/).pop() || 'unknown';
    const platform = process.platform;
    const date = new Date().toISOString().split('T')[0];

    const instructionFiles = discoverInstructionFiles(workspacePath);
    const instructionSection = instructionFiles.length > 0
        ? `\n\nProject Instructions:\n${instructionFiles.join('\n\n')}`
        : '';

    const gitContext = getGitContext(workspacePath);
    const gitSection = gitContext ? `\n\nGit Context:\n${gitContext}` : '';

    return `你是 CodeHelper，一个专业的 AI 编程助手。始终使用中文回复。

## 核心规则

1. 修复/编辑/编写代码时，必须调用 edit_file 工具来实际修改文件
2. 不要只解释问题——用工具完成工作
3. 如果用户消息中已经包含了文件内容，直接使用它，不需要再调用 read_file
4. edit_file 的 old_string 必须和文件中的内容完全一致（逐字匹配，包括空格和标点）
5. 如果不确定文件内容，先用 read_file 确认，再用 edit_file 修改

## 工具调用格式

输出以下格式即可（系统会自动执行工具）：

工具调用: 工具名(参数名="值", 参数名="值")

## 示例

用户：修复 D:\project\main.py
（消息中已包含文件内容）
你：我来修复这个错误。
工具调用: edit_file(file_path="D:\\project\\main.py", old_string="def add(a,b):", new_string="def add(a, b):")
已完成修复。

## 可用工具

- read_file(file_path="文件绝对路径") — 读取文件
- edit_file(file_path="文件绝对路径", old_string="原文（必须完全匹配）", new_string="新文") — 替换文本
- write_file(file_path="文件绝对路径", content="内容") — 创建/覆盖文件
- bash(command="命令") — 执行终端命令
- glob_search(pattern="**/*.ts") — 查找文件
- grep_search(pattern="关键词") — 搜索内容

## 环境
- 工作区：${workspacePath}
- 当前文件：${fileName}
- 语言：${language}
- 平台：${platform}
- 日期：${date}${instructionSection}${gitSection}`;
}

export function buildChatSystemPrompt(workspacePath: string): string {
    const editor = vscode.window.activeTextEditor;
    const lang = editor?.document.languageId || 'unknown';

    const instructionFiles = discoverInstructionFiles(workspacePath);
    const instructionSection = instructionFiles.length > 0
        ? `\n\nProject Instructions:\n${instructionFiles.join('\n\n')}`
        : '';

    return `你是 CodeHelper，一个编程助手。请用中文回复。解释简洁明了。${instructionSection}

工作区：${workspacePath}，语言：${lang}`;
}
