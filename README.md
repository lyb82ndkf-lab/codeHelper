# 🛠️ CodeHelper

> **VS Code AI 编程助手** — 支持 Ollama / OpenAI / Anthropic 多 Provider，集成聊天 + Agent 工具调用 + 内联代码补全三模式。

[![Version](https://img.shields.io/badge/version-3.1.0-blue)](./package.json)
[![VSCode](https://img.shields.io/badge/vscode-%5E1.85.0-0078d7)](./package.json)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

---

## ✨ 功能一览

| 模式             | 说明                                                       |
| ---------------- | ---------------------------------------------------------- |
| 💬 **聊天模式**   | 在侧边栏 Webview 中与 AI 对话，支持流式输出、多轮上下文    |
| 🤖 **Agent 模式** | AI 自主调用工具：读/写文件、执行命令、搜索代码、读取诊断   |
| ✏️ **代码补全**   | 输入时自动触发 FIM（Fill-in-the-Middle）幽灵文本，Tab 接受 |
| 🖱️ **右键操作**   | 选中代码后一键**解释** / **修复** / **优化** / **加注释**  |
| 🩺 **诊断分析**   | 右键「诊断此错误」自动读取 VSCode 诊断信息并分析           |

---

## 🔌 支持的 Provider

| Provider                                   | 配置说明                                                     |
| ------------------------------------------ | ------------------------------------------------------------ |
| [Ollama](https://ollama.com)               | 本地部署，默认 `http://localhost:11434`，适合 qwen2.5-coder 等模型 |
| [OpenAI](https://platform.openai.com)      | GPT-4o / GPT-4o-mini 等，需要 API Key                        |
| [Anthropic](https://console.anthropic.com) | Claude 3.5 Sonnet / Claude 4 等，需要 API Key                |
| 自定义                                     | 兼容 OpenAI 格式的任意 endpoint，如 DeepSeek / 通义千问 / GLM 等 |

---

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/lyb82ndkf-lab/codeHelper.git
cd codeHelper

# 安装依赖
npm install

# 构建
npm run esbuild
```

### 在 VSCode 中运行

1. 按 `F5` 启动 Extension Development Host
2. 左侧活动栏出现 **CodeHelper** 图标（扳手🔧）
3. 点击图标 → 侧边栏中出现聊天面板
4. 在面板上方选择 **Provider** 并填写配置（API Key / 地址 / 模型名）

> ⚠️ **配置安全**：API Key 存储在 `~/.codeHelper/config.json`（用户目录），不会提交到 git 仓库。

### 快速配置

打开 VSCode 设置 → 搜索 `codeHelper`，或直接编辑 `settings.json`：

```jsonc
{
  "codeHelper.provider": "ollama",
  "codeHelper.ollamaUrl": "http://localhost:11434",
  "codeHelper.chatModel": "qwen2.5:7b",
  "codeHelper.completionModel": "qwen2.5-coder:3b",
}
```

---

## 💬 聊天模式

- 在侧边栏聊天面板输入问题，AI 流式回复
- 支持多轮对话历史，自动保存到工作区 `.codeHelper/` 目录
- 支持 `/new` 命令新建对话，`/help` 查看可用命令

## 🤖 Agent 模式

启用 Agent 模式后，AI 可以自主调用以下工具完成复杂任务：

| 工具               | 功能             | 示例场景                  |
| ------------------ | ---------------- | ------------------------- |
| `read_file`        | 读取文件内容     | 分析代码、查看配置        |
| `edit_file`        | 精确替换文件内容 | 修复 bug、重构代码        |
| `write_file`       | 创建/覆写文件    | 生成新模块、配置文件      |
| `bash`             | 执行 shell 命令  | 编译、测试、git 操作      |
| `glob`             | 按模式搜索文件   | 查找项目中所有 `.ts` 文件 |
| `grep`             | 搜索文件内容     | 查找函数调用/引用位置     |
| `read_diagnostics` | 读取 VSCode 诊断 | 分析编译错误              |

> 💡 **小模型友好**：对于 Ollama 等本地模型，Agent 使用纯文本格式传递工具调用（而非原生 function calling），兼容性更好。

Agent 轮次默认上限 20 轮，可在设置中通过 `codeHelper.maxAgentTurns` 调整。

## ✏️ 代码自动补全

- 基于 FIM（Fill-in-the-Middle）的 ghost text 补全
- 输入时**自动触发**（可配置延迟，默认 300ms）
- 按 `Tab` 接受建议，`Esc` 拒绝
- 支持上下文感知：读取光标前后共 100 行（可配置）作为 prompt
- 实验性特性：可通过 `codeHelper.enableAutoTrigger` 关闭自动触发

**推荐的补全模型**：

| 模型                  | 说明                               |
| --------------------- | ---------------------------------- |
| `qwen2.5-coder:3b`    | 轻量本地模型，速度快               |
| `qwen2.5-coder:7b`    | 效果更好，需要更多显存             |
| `deepseek-coder:6.7b` | DeepSeek 代码模型                  |
| `codestral:latest`    | Mistral 代码模型（需 Mistral API） |

## 🖱️ 右键操作

在编辑器中选中代码后右键，可以看到：

| 命令       | 快捷键（建议） | 功能                                 |
| ---------- | -------------- | ------------------------------------ |
| 解释代码   | —              | AI 解释选中代码的作用                |
| 修复代码   | —              | AI 自动修复选中代码中的问题          |
| 优化代码   | —              | AI 重构优化选中代码                  |
| 添加注释   | —              | AI 为选中代码添加中文注释            |
| 诊断此错误 | —              | 读取当前文件的 VSCode 错误诊断并分析 |

---

## ⚙️ 全部配置项

| 配置                           | 默认值                   | 说明                                           |
| ------------------------------ | ------------------------ | ---------------------------------------------- |
| `codeHelper.provider`          | `ollama`                 | Provider：ollama / openai / anthropic / custom |
| `codeHelper.apiKey`            | `""`                     | API Key（存用户目录，不进仓库）                |
| `codeHelper.apiBaseUrl`        | `""`                     | 自定义 API 地址（custom 模式使用）             |
| `codeHelper.ollamaUrl`         | `http://localhost:11434` | Ollama 服务地址                                |
| `codeHelper.chatModel`         | `qwen2.5:3b`             | 聊天/Agent 模型                                |
| `codeHelper.completionModel`   | `qwen2.5-coder:3b`       | 补全模型                                       |
| `codeHelper.enableCompletion`  | `true`                   | 启用内联补全                                   |
| `codeHelper.completionDelay`   | `300`                    | 补全触发延迟 (ms)                              |
| `codeHelper.maxTokens`         | `8192`                   | 最大输出 token 数                              |
| `codeHelper.temperature`       | `0.2`                    | 生成温度（补全建议低值）                       |
| `codeHelper.contextLines`      | `100`                    | 补全上下文行数                                 |
| `codeHelper.enableAutoTrigger` | `true`                   | 自动触发补全                                   |
| `codeHelper.enableAgent`       | `true`                   | 启用 Agent 工具调用                            |
| `codeHelper.maxAgentTurns`     | `20`                     | Agent 最大执行轮次                             |

---

## 🏗️ 项目结构

```
codeHelper/
├── src/
│   ├── agent/           # Agent 循环 + 系统提示词
│   │   ├── agentLoop.ts     # 核心循环：消息 → API → 工具调用 → 继续
│   │   ├── systemPrompt.ts  # Agent 系统提示词
│   │   └── types.ts         # Agent 类型定义
│   ├── chat/            # 聊天面板（WebviewView）
│   │   ├── chatViewProvider.ts  # Webview 提供者
│   │   ├── chatPanelHtml.ts     # HTML 生成
│   │   ├── chatHistory.ts       # 聊天历史管理
│   │   ├── chatPersistence.ts   # 持久化（.codeHelper/）
│   │   └── toolImages.ts        # 工具调用 UI 展示
│   ├── completion/      # 代码补全
│   │   ├── completionProvider.ts  # InlineCompletionItemProvider
│   │   ├── inlineProvider.ts      # 内联提示实现
│   │   ├── codeAnalyzer.ts        # 代码分析
│   │   └── promptBuilder.ts       # FIM prompt 构建
│   ├── config/          # 配置视图
│   │   ├── configTreeView.ts  # 配置树视图
│   │   └── welcomeView.ts     # 欢迎页
│   ├── models/          # API 客户端
│   │   ├── apiClient.ts      # API 调用（流式 + 工具）
│   │   └── modelManager.ts   # 模型管理
│   ├── tools/           # Agent 工具
│   │   ├── fileRead.ts    # 读文件
│   │   ├── fileEdit.ts    # 编辑文件
│   │   ├── fileWrite.ts   # 写文件
│   │   ├── bash.ts        # 执行命令
│   │   ├── glob.ts        # 文件搜索
│   │   ├── grep.ts        # 内容搜索
│   │   ├── diagnosticTool.ts  # 读取诊断
│   │   ├── bashValidation.ts  # 命令安全校验
│   │   └── index.ts          # 工具注册
│   ├── utils/           # 工具函数
│   │   ├── config.ts     # 配置管理（~/.codeHelper/config.json）
│   │   └── logger.ts     # 日志
│   └── extension.ts     # 插件入口
├── resources/           # 静态资源
├── test/                # 测试文件
├── static/              # 图片资源
└── esbuild.js           # 构建脚本
```

---

## 🔧 开发

```bash
# 安装依赖
npm install

# 构建
npm run esbuild

# 监听模式（开发时自动重构建）
npm run watch
```

### 技术栈

- **运行时**：Node.js + VS Code Extension API
- **构建**：esbuild（极速打包）
- **语言**：TypeScript
- **API 协议**：OpenAI 兼容 API 格式（流式 SSE）

---

## 📁 数据存储

| 内容     | 路径                        | 说明                         |
| -------- | --------------------------- | ---------------------------- |
| 聊天记录 | 工作区 `.codeHelper/`       | 按 workspace 隔离            |
| 配置文件 | `~/.codeHelper/config.json` | API Key 等敏感信息存用户目录 |
| 日志     | `~/.codeHelper/logs/`       | 调试日志                     |

---

## 📝 许可

MIT License © 2025 lyb82ndkkkl
