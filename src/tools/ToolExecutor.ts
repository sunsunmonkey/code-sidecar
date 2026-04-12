import * as vscode from "vscode";
import { Tool, ToolDefinition } from "./Tool";
import type { FileChangeTracker } from "./fileChangeTracker";
import { PermissionManager } from "../managers/PermissionManager";
import { ErrorHandler } from "../managers";
import type { ErrorContext } from "../managers";
import { logger } from "code-sidecar-shared/utils/logger";
import { tryResolveWorkspacePath } from "./pathValidation";

import type { ToolUse, ToolResult } from "code-sidecar-shared/types/tools";
import type { PermissionRequest } from "code-sidecar-shared/types/messages";

export class ToolExecutor {
	private tools: Map<string, Tool> = new Map();
	private permissionManager: PermissionManager | undefined;
	private errorHandler: ErrorHandler | undefined;
	private fileChangeTracker: FileChangeTracker | undefined;

	constructor(
		permissionManager: PermissionManager,
		errorHandler: ErrorHandler
	) {
		this.permissionManager = permissionManager;
		this.errorHandler = errorHandler;
	}

	setFileChangeTracker(tracker: FileChangeTracker | undefined): void {
		this.fileChangeTracker = tracker;
	}

	registerTool(tool: Tool): void {
		if (this.tools.has(tool.name)) {
			logger.debug(`Tool ${tool.name} is already registered. Overwriting.`);
		}
		this.tools.set(tool.name, tool);
		logger.debug(`Tool registered: ${tool.name}`);
	}

	unregisterTool(toolName: string): boolean {
		return this.tools.delete(toolName);
	}

	getTool(toolName: string): Tool | undefined {
		return this.tools.get(toolName);
	}

	getToolNames(): string[] {
		return Array.from(this.tools.keys());
	}

	async executeTool(toolUse: ToolUse): Promise<ToolResult> {
		const tool = this.tools.get(toolUse.name);

		if (!tool) {
			logger.debug(`Tool not found: ${toolUse.name}`);
			return {
				type: "tool_result",
				tool_name: toolUse.name,
				content: `Error: Tool '${toolUse.name}' does not exist. Available tools: ${this.getToolNames().join(", ")}`,
				is_error: true,
			};
		}

		if (!tool.validate(toolUse.params)) {
			logger.debug(`Invalid parameters for tool: ${toolUse.name}`, toolUse.params);
			return {
				type: "tool_result",
				tool_name: toolUse.name,
				content: `Error: Invalid parameters for tool '${toolUse.name}'. Expected parameters: ${JSON.stringify(tool.parameters, null, 2)}`,
				is_error: true,
			};
		}

		if (tool.requiresPermission && this.permissionManager) {
			const permissionRequest = this.buildPermissionRequest(tool, toolUse);
			const allowed = await this.permissionManager.checkPermission(permissionRequest);

			if (!allowed) {
				logger.debug(`Permission denied for tool: ${toolUse.name}`);
				return {
					type: "tool_result",
					tool_name: toolUse.name,
					content: `Permission denied: User did not authorize ${tool.name} operation`,
					is_error: true,
				};
			}
		}

		const filePath = typeof toolUse.params.path === "string" ? toolUse.params.path : "";
		const shouldTrackFileChange =
			!!this.fileChangeTracker && this.isFileChangeTool(toolUse.name) && filePath;
		const beforeContent = shouldTrackFileChange ? await this.readFileSafe(filePath) : "";

		try {
			logger.debug(`Executing tool: ${toolUse.name} with params:`, toolUse.params);
			const resultContent = await tool.execute(toolUse.params);
			logger.debug(`Tool ${toolUse.name} executed successfully`);

			const result: ToolResult = {
				type: "tool_result",
				tool_name: toolUse.name,
				content: resultContent,
				is_error: false,
			};

			if (shouldTrackFileChange) {
				const afterContent = await this.readFileSafe(filePath);
				this.fileChangeTracker?.recordChange({
					path: filePath,
					before: beforeContent,
					after: afterContent,
					toolName: toolUse.name,
				});
			}

			return result;
		} catch (error) {
			logger.debug(`Tool execution error for ${toolUse.name}:`, error);

			if (this.errorHandler) {
				const errorContext: ErrorContext = {
					operation: `tool_execution_${toolUse.name}`,
					timestamp: new Date(),
					additionalInfo: { toolName: toolUse.name, params: toolUse.params },
				};
				const errorResponse = this.errorHandler.handleError(error, errorContext);
				return {
					type: "tool_result",
					tool_name: toolUse.name,
					content: errorResponse.userMessage,
					is_error: true,
				};
			}

			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				type: "tool_result",
				tool_name: toolUse.name,
				content: `Error executing tool '${toolUse.name}': ${errorMessage}`,
				is_error: true,
			};
		}
	}

	private isFileChangeTool(toolName: string): boolean {
		return toolName === "write_file" || toolName === "edit";
	}

	private async readFileSafe(filePath: string): Promise<string> {
		const resolvedPath = tryResolveWorkspacePath(filePath);
		if (!resolvedPath) {
			return "";
		}
		try {
			const uri = vscode.Uri.file(resolvedPath);
			const fileContent = await vscode.workspace.fs.readFile(uri);
			return Buffer.from(fileContent).toString("utf-8");
		} catch {
			return "";
		}
	}

	private buildPermissionRequest(tool: Tool, toolUse: ToolUse): PermissionRequest {
		let operation = "unknown";
		let target = "";
		let details = "";

		if (tool.name === "read_file") {
			operation = "read";
		} else if (tool.name === "write_file" || tool.name === "edit") {
			operation = "write";
		} else if (tool.name === "execute_command") {
			operation = "execute";
		}

		if ("path" in toolUse.params) {
			target = toolUse.params.path as string;
		} else if ("command" in toolUse.params) {
			target = toolUse.params.command as string;
		}

		if ("content" in toolUse.params) {
			details = `Content:\n${toolUse.params.content as string}`;
		} else {
			details = `Parameters: ${JSON.stringify(toolUse.params, null, 2)}`;
		}

		return { toolName: tool.name, operation, target, details };
	}

	getToolDefinitions(): ToolDefinition[] {
		return Array.from(this.tools.values()).map((tool) => ({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		}));
	}

	hasTool(toolName: string): boolean {
		return this.tools.has(toolName);
	}

	getToolCount(): number {
		return this.tools.size;
	}

	clearTools(): void {
		this.tools.clear();
		logger.debug("All tools cleared");
	}
}
