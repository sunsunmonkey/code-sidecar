/**
 * MCP Tool Adapter - Wraps MCP tools to work with ToolExecutor
 */

import { BaseTool, ParameterDefinition } from "./Tool";
import { MCPManager } from "../core/mcp/MCPManager";
import type { MCPToolDefinition } from "code-sidecar-shared/types/mcp";
import { logger } from "code-sidecar-shared/utils/logger";

/**
 * Converts MCP tool schema to ToolExecutor parameter definitions
 */
function convertSchemaToParams(tool: MCPToolDefinition): ParameterDefinition[] {
  const params: ParameterDefinition[] = [];
  const properties = tool.inputSchema.properties || {};
  const required = tool.inputSchema.required || [];

  for (const [name, schema] of Object.entries(properties)) {
    let type: ParameterDefinition["type"] = "string";

    switch (schema.type) {
      case "string":
        type = "string";
        break;
      case "number":
      case "integer":
        type = "number";
        break;
      case "boolean":
        type = "boolean";
        break;
      case "object":
        type = "object";
        break;
      case "array":
        type = "array";
        break;
    }

    params.push({
      name,
      type,
      required: required.includes(name),
      description: schema.description || `Parameter ${name}`,
    });
  }

  return params;
}

/**
 * MCPTool wraps an MCP server tool for use with ToolExecutor
 */
export class MCPTool extends BaseTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ParameterDefinition[];
  readonly requiresPermission = true; // MCP tools always require permission

  private readonly serverId: string;
  private readonly serverName: string;
  private readonly originalToolName: string;
  private readonly mcpManager: MCPManager;

  constructor(
    serverId: string,
    serverName: string,
    tool: MCPToolDefinition,
    mcpManager: MCPManager
  ) {
    super();
    this.serverId = serverId;
    this.serverName = serverName;
    this.originalToolName = tool.name;
    // Create unique tool name with server prefix to avoid conflicts
    this.name = `mcp_${serverName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${tool.name}`;
    this.description = `[MCP: ${serverName}] ${tool.description || tool.name}`;
    this.parameters = convertSchemaToParams(tool);
    this.mcpManager = mcpManager;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    logger.debug(`[MCPTool] Executing ${this.name} with params:`, params);

    try {
      const result = await this.mcpManager.callTool(
        this.serverId,
        this.originalToolName,
        params
      );

      // Format result based on type
      if (Array.isArray(result)) {
        // MCP typically returns content array
        return result
          .map((item: { type?: string; text?: string }) => {
            if (item.type === "text" && item.text) {
              return item.text;
            }
            return JSON.stringify(item);
          })
          .join("\n");
      }

      if (typeof result === "string") {
        return result;
      }

      return JSON.stringify(result, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`[MCPTool] Error executing ${this.name}:`, error);
      throw new Error(`MCP tool error (${this.serverName}/${this.originalToolName}): ${message}`);
    }
  }
}

/**
 * MCPToolRegistry manages dynamic registration of MCP tools
 */
export class MCPToolRegistry {
  private registeredTools = new Map<string, MCPTool>();
  private mcpManager: MCPManager;

  constructor(mcpManager: MCPManager) {
    this.mcpManager = mcpManager;
  }

  /**
   * Get all currently registered MCP tools
   */
  getTools(): MCPTool[] {
    return Array.from(this.registeredTools.values());
  }

  /**
   * Refresh tools from all connected MCP servers
   */
  refreshTools(): MCPTool[] {
    // Clear old tools
    this.registeredTools.clear();

    // Get tools from all connected servers
    const allTools = this.mcpManager.getAllTools();

    for (const { serverId, serverName, tool } of allTools) {
      const mcpTool = new MCPTool(serverId, serverName, tool, this.mcpManager);
      this.registeredTools.set(mcpTool.name, mcpTool);
    }

    logger.debug(`[MCPToolRegistry] Refreshed ${this.registeredTools.size} MCP tools`);
    return this.getTools();
  }

  /**
   * Get tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.registeredTools.get(name);
  }

  /**
   * Check if a tool name is an MCP tool
   */
  isMCPTool(name: string): boolean {
    return name.startsWith("mcp_") && this.registeredTools.has(name);
  }
}
