import * as vscode from "vscode";
import { ModeManager } from "./ModeManager";
import { ToolExecutor } from "../tools";
import * as os from "os";

export class PromptBuilder {
	constructor(
		private modeManager: ModeManager,
		private toolExecutor: ToolExecutor
	) {}

	public buildSystemPrompt(): string {
		const sections: string[] = [];
		sections.push(this.getRoleSection());
		sections.push(this.modeManager.getCurrentModePromptFragment());
		sections.push(this.getToolDefinitionsSection());
		sections.push(this.getContextSection());
		sections.push(this.getWorkflowSection());
		sections.push(this.getRulesSection());
		return sections.join("\n\n");
	}

	private getRoleSection(): string {
		const mode = this.modeManager.getCurrentModeDefinition();
		return `# Identity

You are an expert software engineer embedded in VS Code. You think carefully, then act precisely.

**Current Mode**: ${mode.icon} ${mode.name} — ${mode.description}

## Principles
1. **Read before edit** — Always read files before changing them. Never guess.
2. **Minimal changes** — Use \`edit\` for targeted edits. Use \`write_file\` only for new files.
3. **Verify** — Run build/lint/test via \`execute_command\` after making changes.
4. **One tool per response** — Call exactly one tool, then reason about the result.
5. **Bash is universal** — Use \`execute_command\` for anything not covered by other tools: file search, git, diagnostics, project exploration.`;
	}

	private getToolDefinitionsSection(): string {
		const tools = this.toolExecutor.getToolDefinitions();

		if (tools.length === 0) {
			return "# Tools\n\nNo tools available.";
		}

		let section = "# Tools\n\n";
		section += "You have exactly these tools. Use XML tags to call them, one per response.\n\n";

		for (const tool of tools) {
			section += `## ${tool.name}\n`;
			section += `${tool.description}\n`;

			if (tool.parameters.length > 0) {
				for (const param of tool.parameters) {
					const req = param.required ? "required" : "optional";
					section += `- \`${param.name}\` (${param.type}, ${req}): ${param.description}\n`;
				}
			}

			section += "```xml\n";
			section += `<${tool.name}>\n`;
			for (const param of tool.parameters.filter((p) => p.required)) {
				section += `<${param.name}>value</${param.name}>\n`;
			}
			section += `</${tool.name}>\n`;
			section += "```\n\n";
		}

		return section;
	}

	private getContextSection(): string {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		const workspacePath =
			workspaceFolders && workspaceFolders.length > 0
				? workspaceFolders[0].uri.fsPath
				: "No workspace open";
		const shell = os.platform() === "win32" ? "powershell" : process.env.SHELL || "/bin/bash";

		return `# Environment
- OS: ${os.platform()} ${os.arch()}
- Workspace: ${workspacePath}
- Shell: ${shell}`;
	}

	private getWorkflowSection(): string {
		return `# Workflow

1. **Understand** — Read the request. Identify files and scope. State assumptions if ambiguous.
2. **Investigate** — Use \`read_file\` to view files. Use \`execute_command\` to explore:
   - \`find . -name "*.ts" -not -path "*/node_modules/*"\` to list files
   - \`grep -rn "pattern" src/\` to search code
   - \`git status\`, \`git diff\`, \`git log --oneline -20\` for version control
   - \`cat .eslintrc* package.json\` to understand project setup
3. **Plan** — Think through changes. For multi-file edits, determine the order.
4. **Execute** — Make changes with \`edit\` (preferred) or \`write_file\` (new files only).
5. **Verify** — Run linters, type checks, or tests via \`execute_command\`.
6. **Complete** — Call \`attempt_completion\` with a summary.

## edit Tips
- The \`search\` text must match the file exactly (including indentation)
- If an edit fails, re-read the file and retry with correct content
- For insertions, include a few lines of surrounding context in \`search\`
- Do not retry the same failing edit — re-read first
- **For files with HTML/XML/JSX**: Keep \`search\` as short as possible — use only 2-5 unique lines. Avoid including large blocks of markup in search or replace, as angle brackets can interfere with parameter parsing
- When editing HTML/template files, prefer using \`write_file\` for large changes instead of many small edits`;
	}

	private getRulesSection(): string {
		const mode = this.modeManager.getCurrentModeDefinition();
		const maxEdits = mode.maxFileEdits;

		let editRule: string;
		if (maxEdits === 0) {
			editRule = "- **Read-only mode**: Do not modify files unless explicitly asked";
		} else if (maxEdits !== undefined) {
			editRule = `- **Edit budget**: Limit modifications to ${maxEdits} files per task`;
		} else {
			editRule = "- Modify files as needed to complete the task";
		}

		return `# Rules

${editRule}
- Read a file before editing it
- Preserve existing code style and conventions
- Be direct — skip pleasantries, focus on the task
- Never expose secrets or credentials
- Never run destructive commands without user confirmation
- If stuck after two attempts, explain and ask for guidance`;
	}

	public setModeManager(modeManager: ModeManager): void {
		this.modeManager = modeManager;
	}

	public getModeManager(): ModeManager {
		return this.modeManager;
	}
}
