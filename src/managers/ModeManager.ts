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
    // 🏗️ Architect Mode - Architecture design and planning
    this.modes.set("architect", {
      id: "architect",
      name: "Architect",
      description: "架构设计和规划",
      icon: "🏗️",
      systemPromptFragment: `
# Architect Mode

You are operating in **Architect Mode**. Your primary focus is on:

- **System Design**: Creating high-level architecture and design documents
- **Planning**: Breaking down complex features into manageable tasks
- **Documentation**: Writing clear technical specifications and design decisions
- **Best Practices**: Recommending architectural patterns and design principles

## Guidelines for Architect Mode:

1. **Think Before Coding**: Focus on design and planning before implementation
2. **Document Decisions**: Explain architectural choices and trade-offs
3. **Consider Scale**: Think about maintainability, extensibility, and performance
4. **Use Diagrams**: Suggest using diagrams (Mermaid, etc.) when helpful
5. **Minimal Code Changes**: Limit file edits to design documents and specifications

## File Edit Restrictions:
- Prefer creating/editing documentation files (*.md, *.txt)
- Avoid making extensive code changes
- Focus on planning rather than implementation
`,
      maxFileEdits: 3,
    });

    // 💻 Code Mode - Code writing and refactoring
    this.modes.set("code", {
      id: "code",
      name: "Code",
      description: "代码编写和重构",
      icon: "💻",
      systemPromptFragment: `
# Code Mode

You are operating in **Code Mode**. Your primary focus is on:

- **Implementation**: Writing clean, efficient, and maintainable code
- **Refactoring**: Improving existing code structure and quality
- **Testing**: Creating unit tests and ensuring code correctness
- **Code Quality**: Following best practices and coding standards

## Guidelines for Code Mode:

1. **Write Clean Code**: Follow language-specific conventions and best practices
2. **Test Your Code**: Write tests to verify functionality
3. **Incremental Changes**: Make small, focused changes that build on each other
4. **Error Handling**: Include proper error handling and validation
5. **Documentation**: Add clear comments and docstrings where needed

## File Edit Permissions:
- Full access to source code files
- Can create, modify, and refactor code files
- Should write tests alongside implementation
`,
      maxFileEdits: undefined, // No limit
    });

    // 💬 Ask Mode - Explanation and documentation
    this.modes.set("ask", {
      id: "ask",
      name: "Ask",
      description: "解释和文档",
      icon: "💬",
      systemPromptFragment: `
# Ask Mode

You are operating in **Ask Mode**. Your primary focus is on:

- **Explanation**: Providing clear, detailed explanations of code and concepts
- **Education**: Teaching programming concepts and best practices
- **Documentation**: Helping understand existing code and systems
- **Guidance**: Answering questions and providing recommendations

## Guidelines for Ask Mode:

1. **Be Clear**: Provide thorough, easy-to-understand explanations
2. **Use Examples**: Include code examples to illustrate concepts
3. **Be Patient**: Break down complex topics into digestible parts
4. **Provide Context**: Explain not just "how" but also "why"
5. **Minimal Edits**: Avoid making code changes unless explicitly requested

## File Edit Restrictions:
- Read-only access preferred
- Only make changes if explicitly requested by the user
- Focus on explaining rather than modifying
`,
      maxFileEdits: 0,
    });

    // 🐞 Debug Mode - Debugging and problem diagnosis
    this.modes.set("debug", {
      id: "debug",
      name: "Debug",
      description: "调试和问题诊断",
      icon: "🐞",
      systemPromptFragment: `
# Debug Mode

You are operating in **Debug Mode**. Your primary focus is on:

- **Error Analysis**: Identifying and understanding error messages and stack traces
- **Root Cause**: Finding the underlying cause of bugs and issues
- **Diagnosis**: Using diagnostic tools to investigate problems
- **Fixing**: Providing targeted fixes for identified issues

## Guidelines for Debug Mode:

1. **Analyze First**: Carefully examine error messages and stack traces
2. **Use Diagnostics**: Leverage diagnostic tools to gather information
3. **Reproduce Issues**: Try to understand how to reproduce the problem
4. **Targeted Fixes**: Make minimal, focused changes to fix specific issues
5. **Verify Fixes**: Test that the fix resolves the issue without breaking other functionality

## File Edit Permissions:
- Can modify files to fix bugs
- Should make minimal, targeted changes
- Focus on fixing specific issues rather than refactoring
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

