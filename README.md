# CodeHelper

AI 编程助手 VSCode 插件 —— 支持 Ollama / OpenAI / Anthropic 多 Provider + Agent 工具调用。

## 功能

###  聊天 + Agent 双模式
- **聊天模式** - 向 AI 提问代码问题
- **Agent 模式** - AI 自主读写文件、执行命令、搜索代码

###  代码自动补全
- 输入时自动触发灰色幽灵文本
- 按 Tab 接受，Esc 拒绝

###  右键操作（选中代码后）
- **解释代码** / **修复代码** / **优化代码** / **添加注释**
- **诊断此错误** - 读取 VSCode 诊断信息，分析代码错误

###  多 Provider
| Provider | 说明 |
|----------|------|
| Ollama | 本地运行 |
| OpenAI | GPT-4o 等 |
| Anthropic | Claude 系列 |
| 自定义 | DeepSeek/通义千问等 |

###  聊天持久化
聊天记录自动保存到工作区 `.codeHelper/` 目录。

## 使用

1. 打开项目 `code D:\程序\codeHelper`
2. 按 F5 启动调试
3. 左侧面板配置模型，右侧聊天面板对话

## Agent 工具
`read_file` / `edit_file` / `write_file` / `bash` / `glob` / `grep` / `read_diagnostics`
