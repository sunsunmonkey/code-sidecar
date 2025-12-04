# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that implements an AI coding assistant using a ReAct (Reasoning and Acting) loop architecture. The extension provides an interactive chat interface in the VS Code sidebar where an LLM agent can use tools to read files, modify code, execute commands, and complete tasks autonomously.

## Build and Development Commands

### Extension Development
```bash
# Install dependencies (run from root)
pnpm install

# Type check only
pnpm run check-types

# Compile extension (with type check and lint)
pnpm run compile

# Watch mode for development
pnpm run watch

# Lint
pnpm run lint

# Build for production
pnpm run package

# Run tests
pnpm run test
```

### Webview UI Development
```bash
# Navigate to webview-ui directory
cd webview-ui

# Install dependencies (if not using workspace)
pnpm install

# Development server
pnpm run dev

# Build webview UI for production
pnpm run build

# Lint webview code
pnpm run lint
```

### Running the Extension
Press F5 in VS Code to launch the Extension Development Host with the extension loaded.

## Architecture Overview

### Core Architecture: ReAct Loop

The extension implements a **ReAct (Reasoning and Acting) loop** where:
1. User sends a message to the agent
2. LLM receives message + system prompt + conversation history
3. LLM responds with reasoning and/or tool calls (XML format)
4. Tools are executed and results added to conversation
5. Loop continues until LLM calls `attempt_completion` tool

Key files:
- `src/core/task.ts` - Main ReAct loop implementation (`Task` class)
- `src/core/apiHandler.ts` - Streaming LLM API communication

### Tool System

Tools are the primary way the agent interacts with the environment. All tools:
- Extend `BaseTool` from `src/tools/Tool.ts`
- Use **XML-based invocation** (not JSON)
- Are registered in `ToolExecutor` (`src/tools/ToolExecutor.ts`)
- Can require user permission via `PermissionManager`

**Available Tools:**
- `read_file` - Read file contents
- `write_file` - Create/overwrite files
- `list_files` - List directory contents
- `search_files` - Search for text patterns
- `apply_diff` - Apply unified diff patches
- `insert_content` - Insert content at specific line
- `execute_command` - Run terminal commands
- `get_diagnostics` - Get VS Code diagnostics (errors/warnings)
- `list_code_definition_names` - List symbols/definitions
- `attempt_completion` - Signal task completion

**Adding a new tool:**
1. Create tool class in `src/tools/` extending `BaseTool`
2. Implement `name`, `description`, `parameters`, `requiresPermission`, `execute()`
3. Register in `AgentWebviewProvider.registerDefaultTools()`

### Mode System

Four operating modes with different behaviors (defined in `src/managers/ModeManager.ts`):

1. **Architect Mode** - Focus on design/planning, limited file edits (max 3)
2. **Code Mode** - Full coding capabilities, no edit limits
3. **Ask Mode** - Explanation/documentation, no file edits (max 0)
4. **Debug Mode** - Targeted debugging, limited edits (max 5)

Each mode injects a different system prompt fragment via `PromptBuilder`. The mode affects:
- System prompt content
- File edit restrictions
- Agent behavior guidelines

### Manager Components

**PromptBuilder** (`src/managers/PromptBuilder.ts`)
- Dynamically constructs system prompts
- Combines: role definition + mode fragment + tool definitions + context + rules

**PermissionManager** (`src/managers/PermissionManager.ts`)
- Controls which operations require user approval
- Configurable via VS Code settings
- Shows approval dialogs for write/execute/delete operations

**ContextCollector** (`src/managers/ContextCollector.ts`)
- Automatically gathers workspace context
- Collects: open files, visible editors, git info, diagnostics
- Context is prepended to user messages

**ConversationHistoryManager** (`src/managers/ConversationHistoryManager.ts`)
- Maintains chat history with character-based truncation
- Persists history to extension global state
- Supports clearing conversation


**ErrorHandler** (`src/managers/ErrorHandler.ts`)
- Categorizes errors (network, API, file system, permission)
- Implements retry logic with exponential backoff
- Provides user-friendly error messages

### Configuration System

Managed by `ConfigurationManager` (`src/config/ConfigurationManager.ts`). Settings stored in VS Code workspace/user settings under `codingAgent.*`:

**API Configuration:**
- `codingAgent.api.baseUrl` - LLM API endpoint
- `codingAgent.api.model` - Model name
- `codingAgent.api.temperature` - Sampling temperature
- `codingAgent.api.maxTokens` - Max response tokens

**Permission Settings:**
- `codingAgent.permissions.allowReadByDefault`
- `codingAgent.permissions.allowWriteByDefault`
- `codingAgent.permissions.allowExecuteByDefault`
- `codingAgent.permissions.alwaysConfirm` - Operations requiring confirmation

**Agent Behavior:**
- `codingAgent.defaultMode` - Default work mode
- `codingAgent.maxLoopCount` - Max ReAct iterations
- `codingAgent.contextWindowSize` - Max context chars

### Webview UI Architecture

Built with React 19 + Tailwind CSS 4 + React Router:

**Structure:**
- `webview-ui/src/App.tsx` - Main chat interface
- `webview-ui/src/ConfigApp.tsx` - Configuration page
- `webview-ui/src/components/` - UI components
- Message passing via VS Code Webview API

**Key Components:**
- Chat interface with streaming responses
- Mode switcher
- Configuration UI with validation
- Operation history viewer

Built separately from extension using Vite and bundled to `webview-ui/dist/`.

## Important Implementation Details

### XML Tool Invocation Format

The LLM uses XML (not JSON) to call tools:

```xml
<tool_name>
<param1>value1</param1>
<param2>value2</param2>
</tool_name>
```

Parsed using `fast-xml-parser` in `Task.parseAssistantMessage()`.

### Message Flow

1. **User → Extension:** Webview posts message to extension
2. **Extension → Task:** Creates new `Task` instance
3. **Task → API:** Sends system prompt + history to LLM
4. **API → Task:** Streams response chunks
5. **Task → Webview:** Forwards chunks for display
6. **Task → Tools:** Executes tool calls
7. **Tools → Task:** Returns results
8. **Task → History:** Adds results as user messages
9. **Loop continues** until `attempt_completion`

### Conversation History Format

Uses OpenAI-compatible message format:
```typescript
{ role: "system", content: "..." }
{ role: "user", content: "..." }
{ role: "assistant", content: "..." }
```

Tool results are formatted as user messages with special markers:
```
[TOOL RESULT: tool_name]
content
```

### Context Collection

Before each task starts, `ContextCollector` gathers:
- Currently open files
- Active editor file
- Git status (branch, changes)
- VS Code diagnostics
- Workspace root path

Formatted as markdown and prepended to user message.

## Common Development Workflows

### Testing Tool Changes

1. Modify tool in `src/tools/`
2. Run `pnpm run compile` or use watch mode
3. Press F5 to launch Extension Development Host
4. Test tool via chat interface
5. Check console logs in Extension Host for debugging

### Modifying System Prompt

The system prompt is dynamically built by `PromptBuilder`. To modify:
- Edit mode fragments in `ModeManager.ts`
- Edit prompt sections in `PromptBuilder.ts` methods
- Fallback static prompt: `assets/systemPrompt.md` (legacy)

### Adding Configuration Options

1. Add setting to `package.json` under `contributes.configuration.properties`
2. Update `ConfigurationManager.ts` to read/write setting
3. Update configuration UI in `webview-ui/src/ConfigApp.tsx`
4. Update types in `webview-ui/src/types.ts`

### Debugging ReAct Loop Issues

Enable verbose logging by checking:
- `Task.recursivelyMakeRequest()` - Main loop logic
- Console logs prefixed with `[Task taskId]`
- Loop count tracking (`this.loopCount`)
- Tool execution results in webview

### Modifying Webview UI

The webview UI is a standard React app:
1. Make changes in `webview-ui/src/`
2. Run `pnpm run build` in webview-ui directory
3. Reload extension in Extension Development Host
4. For live development, use `pnpm run dev` and edit HTML to load from dev server

## Key Design Patterns

**Dependency Injection:** Managers and tools are injected into Task and ToolExecutor for testability

**Observer Pattern:** ConfigurationManager emits events on config changes

**Strategy Pattern:** Different modes provide different behavioral strategies via prompt fragments

**Chain of Responsibility:** Tool execution flows through permission checks → validation → execution → result formatting

**Singleton Managers:** Each manager is instantiated once in AgentWebviewProvider and shared

## Testing Notes

Tests run using VS Code test framework (`@vscode/test-electron`):
- Test files use `.test.ts` extension
- Run with `pnpm run test`
- Tests execute in a VS Code instance

## Extension Activation

Entry point: `src/extension.ts`

On activation:
1. Creates `AgentWebviewProvider` instance
2. Registers webview view provider
3. Initializes all managers
4. Registers default tools
5. Loads configuration
6. Shows setup wizard if first-time use

## Important Constraints

- **Max loop count:** Default 25 iterations (configurable)
- **Context window:** Default 100k characters (configurable)
- **Tool call format:** Must be valid XML
- **File operations:** Require permission unless disabled in settings
- **API compatibility:** Requires OpenAI-compatible endpoint
