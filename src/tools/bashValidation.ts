// Bash Validation - Ported from claw-code-main bash_validation.rs
// Command classification, read-only validation, destructive command warnings

export type CommandIntent =
    | 'ReadOnly'
    | 'Write'
    | 'Destructive'
    | 'Network'
    | 'PackageManagement'
    | 'SystemAdmin'
    | 'Unknown';

export type ValidationResult =
    | { ok: true }
    | { ok: false; reason: string };

// Commands that only read data
const READ_ONLY_COMMANDS = new Set([
    'cat', 'head', 'tail', 'less', 'more', 'wc', 'sort', 'uniq', 'diff', 'file',
    'ls', 'dir', 'find', 'locate', 'which', 'whereis', 'type',
    'echo', 'printf', 'date', 'cal', 'env', 'printenv', 'set',
    'pwd', 'whoami', 'hostname', 'uname', 'id', 'groups',
    'git status', 'git log', 'git diff', 'git show', 'git blame', 'git branch',
    'git remote', 'git tag', 'git stash list',
    'ps', 'top', 'htop', 'df', 'du', 'free', 'uptime', 'w',
    'man', 'info', 'help', 'whatis', 'apropos',
    'python --version', 'python3 --version', 'node --version', 'npm --version',
    'java -version', 'go version', 'rustc --version',
    'curl -I', 'wget --spider',
]);

// Commands that modify state
const WRITE_COMMANDS = new Set([
    'cp', 'mv', 'rm', 'rmdir', 'mkdir', 'touch', 'chmod', 'chown', 'chgrp',
    'ln', 'mktemp', 'dd',
    'git add', 'git commit', 'git push', 'git pull', 'git merge', 'git rebase',
    'git checkout', 'git switch', 'git reset', 'git revert', 'git stash',
    'git branch -d', 'git branch -D', 'git tag -d',
]);

// Destructive commands
const DESTRUCTIVE_PATTERNS = [
    /rm\s+-rf\s+\//,     // rm -rf /
    /rm\s+-rf\s+~/,      // rm -rf ~
    /mkfs/,               // format filesystem
    /dd\s+.*of=\/dev/,   // dd to device
    /shred/,              // shred files
    />\s+\/dev\/sd/,     // write to disk
    /fork\s*bomb/i,       // fork bomb
    /:(){ :|:& };:/,     // classic fork bomb
];

// Package management commands
const PACKAGE_COMMANDS = new Set([
    'apt', 'apt-get', 'yum', 'dnf', 'pacman', 'brew',
    'npm install', 'npm uninstall', 'npm update',
    'pip install', 'pip uninstall',
    'cargo install', 'cargo uninstall',
    'yarn add', 'yarn remove',
    'pnpm add', 'pnpm remove',
    'docker pull', 'docker push', 'docker run', 'docker build',
    'systemctl', 'service',
]);

export function classifyCommand(command: string): CommandIntent {
    const trimmed = command.trim().toLowerCase();

    // Check destructive first
    for (const pattern of DESTRUCTIVE_PATTERNS) {
        if (pattern.test(trimmed)) return 'Destructive';
    }

    // Check package management
    for (const pkg of PACKAGE_COMMANDS) {
        if (trimmed.startsWith(pkg)) return 'PackageManagement';
    }

    // Check read-only
    for (const ro of READ_ONLY_COMMANDS) {
        if (trimmed.startsWith(ro)) return 'ReadOnly';
    }

    // Check write
    for (const w of WRITE_COMMANDS) {
        if (trimmed.startsWith(w)) return 'Write';
    }

    // Check for write redirections
    if (/\s*>\s/.test(trimmed) || /\s*>>\s/.test(trimmed) || /\s*>&\s/.test(trimmed)) {
        return 'Write';
    }

    // Check sudo
    if (trimmed.startsWith('sudo ')) {
        const inner = trimmed.slice(5);
        for (const ro of READ_ONLY_COMMANDS) {
            if (inner.startsWith(ro)) return 'ReadOnly';
        }
        return 'SystemAdmin';
    }

    return 'Unknown';
}

export function validateCommand(command: string, isReadOnlyMode: boolean): ValidationResult {
    const intent = classifyCommand(command);

    if (isReadOnlyMode) {
        if (intent === 'Write' || intent === 'Destructive' || intent === 'PackageManagement' || intent === 'SystemAdmin') {
            return {
                ok: false,
                reason: `已阻止：命令 "${command.substring(0, 60)}" 是${intent === 'Write' ? '写入' : intent === 'Destructive' ? '破坏性' : intent === 'PackageManagement' ? '包管理' : '系统管理'}命令，在只读模式下不允许执行。`,
            };
        }
    }

    if (intent === 'Destructive') {
        return {
            ok: false,
            reason: `已阻止：检测到破坏性命令 "${command.substring(0, 60)}"`,
        };
    }

    return { ok: true };
}

export function getCommandDescription(command: string): string {
    const intent = classifyCommand(command);
    const descriptions: Record<CommandIntent, string> = {
        ReadOnly: '只读操作',
        Write: '文件/状态修改',
        Destructive: '破坏性操作',
        Network: '网络操作',
        PackageManagement: '包管理',
        SystemAdmin: '系统管理',
        Unknown: '未知操作',
    };
    return descriptions[intent];
}
