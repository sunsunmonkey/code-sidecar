# code-sidecar 🏍️

English | [Chinese](README_ZH.md)

code-sidecar is a VS Code extension project that provides a lightweight sidecar workflow with a webview UI, a core task runner, and tool adapters for LLM-assisted actions.

## Overview

- Focuses on a minimal, understandable architecture for learning and experimentation.
- Keeps the extension host logic in `src/` and the UI in `webview-ui/` for clear separation.
- Provides configurable LLM and permission settings to control behavior.

## Project Structure

- `src/`: VS Code extension entry and logic (`extension.ts`)
- `src/core/`: API handler and task runner
- `src/managers/`: workflow helpers
- `src/tools/`: tool adapters
- `src/ui/`: sidebar and webview glue
- `webview-ui/`: React + Vite client, built to `webview-ui/dist/`
- `assets/`: icons for the activity bar
- `dist/`: build output (generated)

## How It Works (High Level)

1. The extension activates and loads configuration.
2. Core modules handle API requests and orchestrate tasks.
3. The webview UI communicates with the extension for user-facing interactions.

## Chat Commands

- `/init`: Generate or update `AGENTS.md` at the workspace root with concise, repo-specific guidance.

## Configuration

This extension contributes these settings:

- `codeSidecar.api.baseUrl`: Base URL for the LLM API endpoint.
- `codeSidecar.api.model`: Model name to use for LLM requests.
- `codeSidecar.api.temperature`: Temperature for LLM responses (0-2).
- `codeSidecar.api.maxTokens`: Maximum tokens for LLM responses.
- `codeSidecar.permissions.allowReadByDefault`: Allow file read operations without confirmation.
- `codeSidecar.permissions.allowWriteByDefault`: Allow file write operations without confirmation.
- `codeSidecar.permissions.allowExecuteByDefault`: Allow command execution without confirmation.
- `codeSidecar.permissions.alwaysConfirm`: Operations that always require confirmation.
- `codeSidecar.maxLoopCount`: Maximum number of ReAct loop iterations.
- `codeSidecar.contextWindowSize`: Maximum context window size in characters.

## Development

- Install dependencies: `pnpm install`
- Type-check, lint, and build: `pnpm run compile`
- Watch mode: `pnpm run watch`
- Lint only: `pnpm run lint`
- Type checks only: `pnpm run check-types`
- Tests: `pnpm run compile-tests` then `pnpm test`

## Status

- This project is mainly my graduation design and is intended for learning.
- The overall design and content are intentionally simple.
- It is still a WIP and not fully polished.

## Build Notes

- Development and build work used kiro and codex as the main coding assistants.
