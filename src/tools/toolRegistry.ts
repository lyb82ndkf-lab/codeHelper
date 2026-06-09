// Tool Registry - Ported from claw-code-main
// Defines all tool specs with JSON schemas and permission levels

import type { AgentTool } from '../agent/types';

export type PermissionMode = 'ReadOnly' | 'WorkspaceWrite' | 'DangerFullAccess';

export interface ToolSpec {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    requiredPermission: PermissionMode;
}

// ============ Tool Specs (from claw-code mvp_tool_specs) ============

export const toolSpecs: ToolSpec[] = [
    {
        name: 'read_file',
        description: 'Read the contents of a file. Supports line ranges and PDF extraction.',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute path to the file' },
                offset: { type: 'number', description: 'Line number to start reading from (0-based)' },
                limit: { type: 'number', description: 'Maximum number of lines to read' },
            },
            required: ['file_path'],
        },
        requiredPermission: 'ReadOnly',
    },
    {
        name: 'write_file',
        description: 'Write content to a file. Creates parent directories if needed.',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute path to the file' },
                content: { type: 'string', description: 'The content to write' },
            },
            required: ['file_path', 'content'],
        },
        requiredPermission: 'WorkspaceWrite',
    },
    {
        name: 'edit_file',
        description: 'Replace exact text in a file. The old_string must match exactly (including whitespace).',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute path to the file' },
                old_string: { type: 'string', description: 'Exact text to find and replace' },
                new_string: { type: 'string', description: 'Replacement text' },
                replace_all: { type: 'boolean', description: 'Replace all occurrences (default false)' },
            },
            required: ['file_path', 'old_string', 'new_string'],
        },
        requiredPermission: 'WorkspaceWrite',
    },
    {
        name: 'bash',
        description: 'Execute a shell command. Use for building, testing, installing, or any shell operation.',
        inputSchema: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'The shell command to execute' },
                timeout: { type: 'number', description: 'Timeout in ms (default 30000, max 300000)' },
                description: { type: 'string', description: 'What this command does' },
            },
            required: ['command'],
        },
        requiredPermission: 'DangerFullAccess',
    },
    {
        name: 'glob_search',
        description: 'Find files matching a glob pattern. Supports ** for recursive search.',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts")' },
                path: { type: 'string', description: 'Directory to search in (default: workspace root)' },
            },
            required: ['pattern'],
        },
        requiredPermission: 'ReadOnly',
    },
    {
        name: 'grep_search',
        description: 'Search file contents using regex. Returns matching files or content.',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Regex pattern' },
                path: { type: 'string', description: 'File or directory to search' },
                glob: { type: 'string', description: 'Filter by file glob (e.g. "*.ts")' },
                output_mode: { type: 'string', enum: ['content', 'files_with_matches', 'count'], description: 'Output format' },
                context: { type: 'number', description: 'Context lines before/after match' },
                case_insensitive: { type: 'boolean', description: 'Case insensitive search' },
                head_limit: { type: 'number', description: 'Max results (default 250)' },
            },
            required: ['pattern'],
        },
        requiredPermission: 'ReadOnly',
    },
    {
        name: 'read_diagnostics',
        description: 'Read VS Code diagnostics (errors/warnings) for the current workspace.',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Optional: specific file to check' },
            },
        },
        requiredPermission: 'ReadOnly',
    },
];

// ============ Permission Classification ============

export function classifyPermission(toolName: string, args: Record<string, unknown>): PermissionMode {
    const spec = toolSpecs.find(t => t.name === toolName);
    if (!spec) return 'DangerFullAccess';

    // Bash: always dangerous
    if (toolName === 'bash') return 'DangerFullAccess';

    // Read-only tools
    if (spec.requiredPermission === 'ReadOnly') return 'ReadOnly';

    // Write tools
    if (spec.requiredPermission === 'WorkspaceWrite') return 'WorkspaceWrite';

    return spec.requiredPermission;
}

// ============ Tool Registry (combines specs with implementations) ============

export class ToolRegistry {
    private tools = new Map<string, AgentTool>();

    register(tool: AgentTool): void {
        this.tools.set(tool.name, tool);
    }

    registerAll(tools: AgentTool[]): void {
        for (const t of tools) { this.register(t); }
    }

    get(name: string): AgentTool | undefined {
        return this.tools.get(name);
    }

    getAll(): AgentTool[] {
        return Array.from(this.tools.values());
    }

    getSpecs(): ToolSpec[] {
        return toolSpecs;
    }

    getDefinitions(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
        return toolSpecs.map(spec => ({
            type: 'function' as const,
            function: {
                name: spec.name,
                description: spec.description,
                parameters: spec.inputSchema,
            },
        }));
    }
}

// ============ Global Registry ============

export const globalToolRegistry = new ToolRegistry();
