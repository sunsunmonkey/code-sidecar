import type { WorkMode } from "code-sidecar-shared/types/modes";
import { logger } from "code-sidecar-shared/utils/logger";

/**
 * Mode definition interface
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export interface ModeDefinition {
  id: WorkMode;
  name: string;
  description: string;
  icon: string;
  systemPromptFragment: string;
  maxFileEdits?: number;
}

/**
 * ModeManager manages different work modes and their configurations
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export class ModeManager {
  private currentMode: WorkMode = "code";
  private modes: Map<WorkMode, ModeDefinition> = new Map();

  constructor() {
    this.initializeDefaultModes();
  }

  /**
   * Initialize the four preset modes
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  private initializeDefaultModes(): void {
    this.modes.set("architect", {
      id: "architect",
      name: "Architect",
      description: "架构设计和规划",
      icon: "🏗️",
      systemPromptFragment: `
# Architect Mode

You are in **Architect Mode** — focused on design, planning, and technical strategy.

## Priorities
1. **Analyze first** — Understand the codebase structure before proposing changes
2. **Design documents** — Create clear technical specs, not implementation code
3. **Trade-off analysis** — Explain pros/cons of different approaches
4. **Incremental plans** — Break large tasks into well-ordered steps
5. **Minimal code changes** — Only create/edit documentation and design files
`,
      maxFileEdits: 3,
    });

    this.modes.set("code", {
      id: "code",
      name: "Code",
      description: "代码编写和重构",
      icon: "💻",
      systemPromptFragment: `
# Code Mode

You are in **Code Mode** — focused on writing, editing, and refactoring code.

## Priorities
1. **Read before edit** — Always read the file first. Never guess contents.
2. **Surgical edits** — Use \`edit\` for targeted changes. Reserve \`write_file\` for new files.
3. **Match conventions** — Mirror the existing code style: naming, indentation, import patterns, framework choices.
4. **Verify changes** — Run linters, type checks, or tests after edits when possible.
5. **Keep it minimal** — Make the smallest change that correctly solves the problem. Don't refactor unrelated code.

## Edit Strategy
- For single-file changes: read → edit → execute_command (verify)
- For multi-file changes: plan the order, then edit files one by one
- For new files: check existing files in the same directory for patterns first
- After edits: run the build or linter to catch errors early
`,
      maxFileEdits: undefined,
    });

    this.modes.set("ask", {
      id: "ask",
      name: "Ask",
      description: "解释和文档",
      icon: "💬",
      systemPromptFragment: `
# Ask Mode

You are in **Ask Mode** — focused on explaining, teaching, and answering questions.

## Priorities
1. **Read the code** — Use tools to read the actual source before explaining
2. **Be precise** — Reference specific files, functions, and line numbers
3. **Explain "why"** — Don't just describe what code does, explain the reasoning
4. **Use examples** — Include code snippets to illustrate concepts
5. **No edits** — Do not modify files unless the user explicitly asks
`,
      maxFileEdits: 0,
    });

    this.modes.set("debug", {
      id: "debug",
      name: "Debug",
      description: "调试和问题诊断",
      icon: "🐞",
      systemPromptFragment: `
# Debug Mode

You are in **Debug Mode** — focused on finding and fixing bugs systematically.

## Approach
1. **Gather evidence** — Use \`read_file\` and \`execute_command\` (grep, build output, test output) to understand the error
2. **Form hypothesis** — Identify the most likely root cause
3. **Verify** — Read the relevant source code to confirm
4. **Fix precisely** — Use \`edit\` for the minimal fix
5. **Validate** — Run tests or build to confirm the fix works

## Rules
- Never guess — always read the actual error output and source code
- Make one fix at a time and verify before moving on
- If the first fix doesn't work, re-analyze rather than trying random changes
`,
      maxFileEdits: 5,
    });
  }

  /**
   * Switch to a different work mode
   * Requirements: 7.5, 7.6
   */
  public switchMode(mode: WorkMode): void {
    if (!this.modes.has(mode)) {
      throw new Error(`Unknown work mode: ${mode}`);
    }
    this.currentMode = mode;
    logger.debug(`[ModeManager] Switched to ${mode} mode`);
  }

  /**
   * Get the current work mode
   * Requirements: 7.5, 7.6
   */
  public getCurrentMode(): WorkMode {
    return this.currentMode;
  }

  /**
   * Get the current mode definition
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  public getCurrentModeDefinition(): ModeDefinition {
    const mode = this.modes.get(this.currentMode);
    if (!mode) {
      throw new Error(`Mode definition not found for: ${this.currentMode}`);
    }
    return mode;
  }

  /**
   * Get mode definition by ID
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  public getModeDefinition(mode: WorkMode): ModeDefinition | undefined {
    return this.modes.get(mode);
  }

  /**
   * Get all available modes
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  public getAllModes(): ModeDefinition[] {
    return Array.from(this.modes.values());
  }

  /**
   * Get the system prompt fragment for the current mode
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
   */
  public getCurrentModePromptFragment(): string {
    const mode = this.getCurrentModeDefinition();
    return mode.systemPromptFragment;
  }

  /**
   * Get the maximum file edits allowed for the current mode
   * Returns undefined if no limit
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  public getMaxFileEdits(): number | undefined {
    const mode = this.getCurrentModeDefinition();
    return mode.maxFileEdits;
  }

  /**
   * Register a custom mode
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  public registerMode(mode: ModeDefinition): void {
    this.modes.set(mode.id, mode);
    logger.debug(`[ModeManager] Registered custom mode: ${mode.id}`);
  }

  /**
   * Check if a mode exists
   */
  public hasMode(mode: WorkMode): boolean {
    return this.modes.has(mode);
  }
}

