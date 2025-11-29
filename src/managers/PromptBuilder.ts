import * as vscode from "vscode";
import { ModeManager } from "./ModeManager";
import { ToolExecutor } from "../tools";
import * as os from "os";
import * as path from "path";

/**
 * PromptBuilder dynamically constructs system prompts
 * Requirements: 6.1, 7.1, 13.1, 13.2
 */
export class PromptBuilder {
  constructor(
    private modeManager: ModeManager,
    private toolExecutor: ToolExecutor,
    private context: vscode.ExtensionContext
  ) {}

  /**
   * Build the complete system prompt
   * Requirements: 6.1, 7.1, 13.1, 13.2
   */
  public buildSystemPrompt(): string {
    const sections: string[] = [];

    // 1. Role and Identity
    sections.push(this.getRoleSection());

    // 2. Current Mode Fragment
    sections.push(this.modeManager.getCurrentModePromptFragment());

    // 3. Tool Definitions
    sections.push(this.getToolDefinitionsSection());

    // 4. Context Information
    sections.push(this.getContextSection());

    // 5. Capabilities
    sections.push(this.getCapabilitiesSection());

    // 6. Rules and Guidelines
    sections.push(this.getRulesSection());

    // 7. Goal
    sections.push(this.getGoalSection());

    return sections.join("\n\n");
  }

  /**
   * Get role and identity section
   */
  private getRoleSection(): string {
    const mode = this.modeManager.getCurrentModeDefinition();
    return `# AI Coding Assistant

You are an AI coding assistant integrated into Visual Studio Code. You help developers with code analysis, debugging, refactoring, and implementation tasks.

**Current Mode**: ${mode.icon} ${mode.name} - ${mode.description}`;
  }

  /**
   * Get tool definitions section
   * Requirements: 13.1, 13.2
   */
  private getToolDefinitionsSection(): string {
    const tools = this.toolExecutor.getToolDefinitions();
    
    if (tools.length === 0) {
      return "# Available Tools\n\nNo tools are currently available.";
    }

    let section = "# Available Tools\n\n";
    section += "You have access to the following tools to interact with the project:\n\n";

    for (const tool of tools) {
      section += `## ${tool.name}\n\n`;
      section += `${tool.description}\n\n`;
      
      if (tool.parameters.length > 0) {
        section += "**Parameters:**\n\n";
        for (const param of tool.parameters) {
          const required = param.required ? "(required)" : "(optional)";
          section += `- \`${param.name}\` (${param.type}) ${required}: ${param.description}\n`;
        }
        section += "\n";
      }

      section += "**Usage Example:**\n\n";
      section += "```xml\n";
      section += `<${tool.name}>\n`;
      for (const param of tool.parameters.filter(p => p.required)) {
        section += `<${param.name}>value</${param.name}>\n`;
      }
      section += `</${tool.name}>\n`;
      section += "```\n\n";
    }

    section += this.getToolUsageInstructions();

    return section;
  }

  /**
   * Get tool usage instructions
   */
  private getToolUsageInstructions(): string {
    return `## Tool Usage Instructions

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags.

**Important Rules:**
1. Always use the exact tool name as the XML tag name
2. Each parameter must be in its own tag
3. Required parameters must be provided
4. Tool calls must be properly formatted XML
5. You can call multiple tools in sequence

**Example:**
\`\`\`xml
<tool_name>
<parameter1>value1</parameter1>
<parameter2>value2</parameter2>
</tool_name>
\`\`\`
`;
  }

  /**
   * Get context information section
   */
  private getContextSection(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspacePath = workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : "No workspace open";

    return `# Context Information

**Operating System**: ${os.platform()} (${os.arch()})
**Workspace**: ${workspacePath}
**VSCode Version**: ${vscode.version}`;
  }

  /**
   * Get capabilities section
   */
  private getCapabilitiesSection(): string {
    return `# Capabilities

You can:
- Read and analyze code files
- Write and modify files (with user permission)
- Search for patterns in the codebase
- Execute commands in the terminal
- Access diagnostic information (errors, warnings)
- Navigate the project structure
- Provide explanations and suggestions

Your responses should be:
- Clear and concise
- Technically accurate
- Actionable and practical
- Focused on the current mode's objectives`;
  }

  /**
   * Get rules and guidelines section
   */
  private getRulesSection(): string {
    const mode = this.modeManager.getCurrentModeDefinition();
    const maxEdits = mode.maxFileEdits;
    
    let editRestriction = "";
    if (maxEdits === 0) {
      editRestriction = "- **File Editing**: Avoid making file changes unless explicitly requested";
    } else if (maxEdits !== undefined) {
      editRestriction = `- **File Editing**: Limit file modifications to ${maxEdits} files per task`;
    } else {
      editRestriction = "- **File Editing**: You can modify files as needed for the task";
    }

    return `# Rules and Guidelines

## General Rules:
- Always use tools to interact with the project (don't make assumptions)
- Verify information before making changes
- Ask for clarification when requirements are unclear
- Respect user permissions and confirmations
- Provide reasoning for your actions

## Mode-Specific Rules:
${editRestriction}
- Follow the guidelines specific to ${mode.name} mode
- Stay focused on the mode's primary objectives

## Markdown Formatting:
- Use proper markdown syntax in your responses
- Format code blocks with appropriate language tags
- Use lists, headers, and emphasis for clarity

## Error Handling:
- If a tool fails, explain the error and suggest alternatives
- Don't retry the same failing operation repeatedly
- Ask for user input when stuck`;
  }

  /**
   * Get goal section
   */
  private getGoalSection(): string {
    return `# Goal

Your goal is to assist the developer effectively by:
1. Understanding their request or problem
2. Using available tools to gather information
3. Analyzing the situation and forming a plan
4. Taking appropriate actions using tools
5. Providing clear explanations and results

Always think step-by-step and use tools to accomplish tasks. When you've completed the task, use the appropriate completion tool to signal you're done.`;
  }

  /**
   * Update the mode manager (for mode switching)
   */
  public setModeManager(modeManager: ModeManager): void {
    this.modeManager = modeManager;
  }

  /**
   * Get the current mode manager
   */
  public getModeManager(): ModeManager {
    return this.modeManager;
  }
}
