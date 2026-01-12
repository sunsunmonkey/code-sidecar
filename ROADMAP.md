# Code-Sidecar Roadmap

> 最后更新: 2026-01-04

## 项目概述

Code-Sidecar 是一个轻量级 VS Code 扩展，提供 LLM 辅助编码的 sidecar 工作流。项目采用 Extension Host + Webview UI 架构，支持多种工作模式和工具调用。

---

## 📊 当前状态

### ✅ 已完成功能

| 功能         | 描述                                | 状态 |
| ------------ | ----------------------------------- | ---- |
| 基础架构     | Extension + Webview 双层架构        | ✅   |
| API 集成     | OpenAI 兼容 API 调用                | ✅   |
| 流式响应     | 支持 SSE 流式输出                   | ✅   |
| 工具系统     | 10 个内置工具                       | ✅   |
| 权限管理     | 读/写/执行权限控制                  | ✅   |
| 工作模式     | 4 种模式 (Architect/Code/Ask/Debug) | ✅   |
| 对话历史     | 会话持久化与管理                    | ✅   |
| Diff 预览    | 任务级文件变更预览面板              | ✅   |
| `/init` 命令 | 生成 AGENTS.md 指导文件             | ✅   |
| 配置页面     | API 配置与权限设置 UI               | ✅   |
| 右键菜单     | 分析选中代码                        | ✅   |

### 🔧 已实现工具

| 工具名称                     | 功能               | 需要权限 |
| ---------------------------- | ------------------ | -------- |
| `read_file`                  | 读取文件内容       | ❌       |
| `write_file`                 | 写入文件           | ✅       |
| `apply_diff`                 | 精确代码编辑       | ✅       |
| `insert_content`             | 插入内容到指定位置 | ✅       |
| `list_files`                 | 列出目录文件       | ❌       |
| `search_files`               | 正则搜索文件内容   | ❌       |
| `execute_command`            | 执行 Shell 命令    | ✅       |
| `get_diagnostics`            | 获取诊断信息       | ❌       |
| `list_code_definition_names` | 列出代码定义       | ❌       |
| `attempt_completion`         | 完成任务           | ❌       |

---

## 🐛 已知问题 & 技术债务

### 高优先级

| 问题         | 位置                                          | 描述                                   |
| ------------ | --------------------------------------------- | -------------------------------------- |
| 缓存优化     | [task.ts#L349](src/core/task.ts#L349)         | TODO: 系统提示缓存机制需要评估是否有效 |
| 消息类型收口 | [apiHandler.ts#L9](src/core/apiHandler.ts#L9) | TODO: 需要统一消息类型定义             |

### 中优先级

| 问题            | 描述                           |
| --------------- | ------------------------------ |
| 缺少单元测试    | 项目目前没有任何测试文件       |
| 错误处理不完善  | 部分边界情况未处理             |
| 代码重复        | 部分工具类有重复的路径验证逻辑 |
| TypeScript 类型 | 部分地方使用了 `any` 类型      |

### 低优先级

| 问题       | 描述                     |
| ---------- | ------------------------ |
| 日志不规范 | 缺少统一的日志级别和格式 |
| 文档不完善 | 缺少 API 文档和架构文档  |
| 国际化     | 目前只有中英文 README    |

---

## 🚀 Feature Roadmap

### Phase 1: 稳定性 & 测试 (优先)

- [x] **错误处理增强**

  - 统一错误类型定义
  - 完善 API 调用重试机制
  - 添加用户友好的错误提示

- [x] **代码重构**
  - 提取公共的路径验证工具
  - 统一消息类型 (`HistoryItem`, `DisplayMessage` 等)
  - 清理 `any` 类型

### Phase 2: 功能增强

- [x] **上下文管理增强**

  - 支持 `@file` 引用文件
  - 支持 `@workspace` 引用工作区结构

- [ ] **工具扩展**

  - `create_file` - 创建新文件工具
  - `rename_file` - 重命名/移动文件
  - `delete_file` - 删除文件 (高危操作)
  - `run_tests` - 运行测试并获取结果

- [ ] **会话管理增强**

  - 会话重命名
  - 会话导出/导入
  - 会话搜索

### Phase 3: 高级功能

- [x] **TODO List 工具**

  - 实现 `update_todo_list` 工具
  - UI 展示任务进度

- [ ] **多工作区支持**

  - 支持多 folder workspace
  - 每个工作区独立配置

- [ ] **Agent 能力增强**

  - 子任务分解
  - 并行工具调用
  - 任务中断与恢复

- [ ] **代码审查模式**
  - PR diff 分析
  - 代码质量建议
  - 安全漏洞检测

### Phase 4: 体验优化

- [ ] **UI/UX 改进**

  - 主题适配优化
  - 快捷键支持
  - 拖拽上传文件
  - 消息编辑功能

- [ ] **性能优化**

  - 大文件处理优化
  - 流式渲染优化
  - 内存使用优化

- [ ] **可观测性**
  - Token 使用统计面板
  - 操作历史回放
  - 性能指标监控

---

## 📋 技术改进建议

### 架构改进

1. **状态管理**: 考虑在 Webview 使用 Zustand 或类似状态管理库
2. **消息协议**: 定义更清晰的 Extension ↔ Webview 消息协议
3. **工具注册**: 支持动态工具注册和热插拔

### 代码质量

1. **类型安全**: 消除所有 `any` 类型，使用更严格的类型定义
2. **测试覆盖**: 目标 80% 核心代码测试覆盖率
3. **文档注释**: 为所有公共 API 添加 JSDoc 注释

### 安全性

1. **API Key 管理**: 考虑使用 VS Code Secret Storage
2. **命令执行**: 添加命令白名单/黑名单机制
3. **文件访问**: 更细粒度的文件访问控制

---

## 🎯 里程碑计划

| 里程碑 | 目标                    | 预计时间 |
| ------ | ----------------------- | -------- |
| v0.1.0 | 基础功能稳定，添加测试  | -        |
| v0.2.0 | 上下文增强，工具扩展    | -        |
| v0.3.0 | 多 API 支持，Agent 增强 | -        |
| v1.0.0 | 功能完整，文档齐全      | -        |

---

## 📝 贡献指南

参见 [AGENTS.md](./AGENTS.md) 了解项目规范和开发指南。

### 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm run watch

# 类型检查
pnpm run check-types

# 代码检查
pnpm run lint

# 构建
pnpm run compile

# 测试
pnpm run compile-tests && pnpm test
```

---

## 📚 参考资源

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

- After all required files have been modified and before marking the task as complete, ensure that you run the following commands from the repository root directory to verify the changes:

1. pnpm --filter webview-ui build
2. pnpm esbuild
3. pnpm tsc
   These checks are required before considering the changes complete.
