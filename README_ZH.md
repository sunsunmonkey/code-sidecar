# code-sidecar 🏍️

[English](README.md) | 中文

code-sidecar 是一个 VS Code 扩展项目，提供轻量的 sidecar 工作流，包含 webview UI、核心任务执行器，以及用于 LLM 辅助操作的工具适配层。

## 概述

- 以学习和实验为主，结构尽量清晰、易理解。
- 扩展逻辑位于 `src/`，前端 UI 位于 `webview-ui/`，便于分层维护。
- 提供 LLM 相关配置与权限开关，便于控制行为。

## 项目结构

- `src/`: VS Code 扩展入口与核心逻辑（`extension.ts`）
- `src/core/`: API 处理与任务执行
- `src/managers/`: 工作流辅助模块
- `src/tools/`: 工具适配层
- `src/ui/`: 侧边栏与 webview 连接层
- `webview-ui/`: React + Vite 客户端，产物输出到 `webview-ui/dist/`
- `assets/`: 活动栏图标
- `dist/`: 构建产物（自动生成）

## 工作流程（概览）

1. 扩展激活并读取配置。
2. core 模块处理 API 请求并编排任务流程。
3. webview UI 与扩展通信，负责用户交互展示。

## 聊天指令

- `/init`：在工作区根目录生成或更新 `AGENTS.md`，整理仓库相关的简明规范。

## 配置项

本扩展提供以下设置：

- `codeSidecar.api.baseUrl`: LLM API 访问地址。
- `codeSidecar.api.model`: LLM 模型名称。
- `codeSidecar.api.temperature`: 生成温度（0-2）。
- `codeSidecar.api.maxTokens`: 生成 token 上限。
- `codeSidecar.permissions.allowReadByDefault`: 默认允许读文件。
- `codeSidecar.permissions.allowWriteByDefault`: 默认允许写文件。
- `codeSidecar.permissions.allowExecuteByDefault`: 默认允许执行命令。
- `codeSidecar.permissions.alwaysConfirm`: 始终需要确认的操作。
- `codeSidecar.maxLoopCount`: ReAct 循环最大次数。
- `codeSidecar.contextWindowSize`: 上下文窗口最大字符数。

## 开发与测试

- 安装依赖：`pnpm install`
- 类型检查/构建：`pnpm run compile`
- 监听模式：`pnpm run watch`
- 仅 lint：`pnpm run lint`
- 仅类型检查：`pnpm run check-types`
- 测试：先 `pnpm run compile-tests`，再执行 `pnpm test`

## 当前状态

- 本项目主要是我的毕业设计，侧重学习用途。
- 内容设计相对简单。
- 目前仍在完善中，属于 WIP 状态。

## 构建说明

- 项目开发与构建过程中主要使用了 kiro 和 codex 作为辅助编程工具。
