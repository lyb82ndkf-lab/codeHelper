// 代码补全 Prompt 构建

export interface PromptContext {
    language: string;
    fileName: string;
    prefix: string;
    suffix: string;
}

const langNames: Record<string, string> = {
    javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
    java: 'Java', csharp: 'C#', cpp: 'C++', c: 'C', go: 'Go',
    rust: 'Rust', php: 'PHP', ruby: 'Ruby', swift: 'Swift',
    kotlin: 'Kotlin', sql: 'SQL', html: 'HTML', css: 'CSS',
    scss: 'SCSS', json: 'JSON', yaml: 'YAML', xml: 'XML',
    shellscript: 'Shell', powershell: 'PowerShell', lua: 'Lua',
};

export function buildCompletionPrompt(ctx: PromptContext): string {
    const lang = langNames[ctx.language] || ctx.language;
    const suffix = ctx.suffix ? `\n${ctx.suffix}\n--- 代码结束 ---` : '\n--- 代码结束 ---';
    return `你是一个代码补全助手。根据以下代码上下文，补全光标位置的代码。
只输出要补全的代码，不要解释，不要包含已有代码，不要加 markdown 代码块标记。
语言: ${lang}
文件: ${ctx.fileName}

--- 代码开始 ---
${ctx.prefix}
// [光标位置]${suffix}

补全:`;
}

export function buildChatPrompt(
    action: 'explain' | 'fix' | 'optimize' | 'comment',
    selectedCode: string, language: string
): string {
    const lang = langNames[language] || language;
    const templates: Record<string, string> = {
        explain: `请详细解释以下代码的功能、逻辑和关键点：\n\n\`\`\`${lang}\n${selectedCode}\n\`\`\``,
        fix: `以下代码有错误，请分析错误原因并提供修复后的完整代码：\n\n\`\`\`${lang}\n${selectedCode}\n\`\`\``,
        optimize: `请优化以下代码，提升性能和可读性，并说明优化了什么：\n\n\`\`\`${lang}\n${selectedCode}\n\`\`\``,
        comment: `请为以下代码添加详细的中文注释，包括函数说明、参数说明、逻辑说明：\n\n\`\`\`${lang}\n${selectedCode}\n\`\`\``,
    };
    return templates[action] || selectedCode;
}
