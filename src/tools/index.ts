import type { AgentTool } from '../agent/types';
import { fileReadTool } from './fileRead';
import { fileEditTool } from './fileEdit';
import { fileWriteTool } from './fileWrite';
import { bashTool } from './bash';
import { globTool } from './glob';
import { grepTool } from './grep';
import { diagnosticTool } from './diagnosticTool';

export const allTools: AgentTool[] = [
    fileReadTool, fileEditTool, fileWriteTool,
    bashTool, globTool, grepTool, diagnosticTool,
];

export function findTool(name: string): AgentTool | undefined {
    return allTools.find(t => t.name === name);
}
