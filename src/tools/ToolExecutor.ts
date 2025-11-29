import { Tool, ToolDefinition } from './Tool';
import { ToolUse, ToolResult } from '../core/task';
import { PermissionManager, PermissionRequest } from '../managers/PermissionManager';
import { OperationHistoryManager } from '../managers/OperationHistoryManager';
import { ErrorHandler, ErrorContext } from '../managers/ErrorHandler';

/**
 * ToolExecutor manages tool registration and execution
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 5.1, 5.2
 */
export class ToolExecutor {
  private tools: Map<string, Tool> = new Map();
  private permissionManager: PermissionManager | undefined;
  private operationHistoryManager: OperationHistoryManager | undefined;
  private errorHandler: ErrorHandler | undefined;

  /**
   * Set permission manager for tool execution
   * Requirements: 5.1, 5.2
   * @param permissionManager Permission manager instance
   */
  setPermissionManager(permissionManager: PermissionManager): void {
    this.permissionManager = permissionManager;
    console.log('[ToolExecutor] Permission manager set');
  }

  /**
   * Set operation history manager for recording operations
   * Requirements: 11.1, 11.2
   * @param operationHistoryManager Operation history manager instance
   */
  setOperationHistoryManager(operationHistoryManager: OperationHistoryManager): void {
    this.operationHistoryManager = operationHistoryManager;
    
    // Set operation history manager on all registered tools that support it
    for (const tool of this.tools.values()) {
      if ('setOperationHistoryManager' in tool && typeof (tool as any).setOperationHistoryManager === 'function') {
        (tool as any).setOperationHistoryManager(operationHistoryManager);
      }
    }
    
    console.log('[ToolExecutor] Operation history manager set');
  }

  /**
   * Set error handler for tool execution error handling
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
   * @param errorHandler Error handler instance
   */
  setErrorHandler(errorHandler: ErrorHandler): void {
    this.errorHandler = errorHandler;
    console.log('[ToolExecutor] Error handler set');
  }

  /**
   * Register a tool
   * Requirement: 13.2
   * @param tool Tool instance to register
   */
  registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
    
    // Set operation history manager on the tool if it supports it
    if (this.operationHistoryManager && 'setOperationHistoryManager' in tool && typeof (tool as any).setOperationHistoryManager === 'function') {
      (tool as any).setOperationHistoryManager(this.operationHistoryManager);
    }
    
    console.log(`Tool registered: ${tool.name}`);
  }

  /**
   * Unregister a tool
   * @param toolName Name of the tool to unregister
   */
  unregisterTool(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  /**
   * Get a registered tool by name
   * @param toolName Name of the tool
   * @returns Tool instance or undefined
   */
  getTool(toolName: string): Tool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get all registered tool names
   * @returns Array of tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Execute a tool call
   * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 5.1, 5.2
   * @param toolUse Tool use request from LLM
   * @returns Promise<ToolResult> Tool execution result
   */
  async executeTool(toolUse: ToolUse): Promise<ToolResult> {
    const tool = this.tools.get(toolUse.name);

    // Handle unknown tool (Requirement 13.7)
    if (!tool) {
      console.error(`Tool not found: ${toolUse.name}`);
      return {
        type: 'tool_result',
        tool_name: toolUse.name,
        content: `Error: Tool '${toolUse.name}' does not exist. Available tools: ${this.getToolNames().join(', ')}`,
        is_error: true,
      };
    }

    // Validate parameters (Requirement 13.7)
    if (!tool.validate(toolUse.params)) {
      console.error(`Invalid parameters for tool: ${toolUse.name}`, toolUse.params);
      return {
        type: 'tool_result',
        tool_name: toolUse.name,
        content: `Error: Invalid parameters for tool '${toolUse.name}'. Expected parameters: ${JSON.stringify(tool.parameters, null, 2)}`,
        is_error: true,
      };
    }

    // Check permissions if tool requires it (Requirements 5.1, 5.2)
    if (tool.requiresPermission && this.permissionManager) {
      const permissionRequest = this.buildPermissionRequest(tool, toolUse);
      const allowed = await this.permissionManager.checkPermission(permissionRequest);
      
      if (!allowed) {
        console.log(`Permission denied for tool: ${toolUse.name}`);
        return {
          type: 'tool_result',
          tool_name: toolUse.name,
          content: `Permission denied: User did not authorize ${tool.name} operation`,
          is_error: true,
        };
      }
    }

    try {
      console.log(`Executing tool: ${toolUse.name} with params:`, toolUse.params);
      
      // Execute the tool (Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6)
      const result = await tool.execute(toolUse.params);
      
      console.log(`Tool ${toolUse.name} executed successfully`);
      
      return {
        type: 'tool_result',
        tool_name: toolUse.name,
        content: result,
        is_error: false,
      };
    } catch (error) {
      console.error(`Tool execution error for ${toolUse.name}:`, error);
      
      // Use error handler if available (Requirements 12.2, 12.3)
      if (this.errorHandler) {
        const errorContext: ErrorContext = {
          operation: `tool_execution_${toolUse.name}`,
          timestamp: new Date(),
          additionalInfo: {
            toolName: toolUse.name,
            params: toolUse.params,
          },
        };
        
        const errorResponse = this.errorHandler.handleError(error, errorContext);
        
        return {
          type: 'tool_result',
          tool_name: toolUse.name,
          content: errorResponse.userMessage,
          is_error: true,
        };
      }
      
      // Fallback if no error handler
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        type: 'tool_result',
        tool_name: toolUse.name,
        content: `Error executing tool '${toolUse.name}': ${errorMessage}`,
        is_error: true,
      };
    }
  }

  /**
   * Build permission request from tool and parameters
   * Requirements: 5.1, 5.2
   */
  private buildPermissionRequest(tool: Tool, toolUse: ToolUse): PermissionRequest {
    // Determine operation type based on tool name
    let operation = 'unknown';
    let target = '';
    let details = '';

    if (tool.name.includes('read')) {
      operation = 'read';
    } else if (tool.name.includes('write') || tool.name.includes('modify')) {
      operation = 'write';
    } else if (tool.name.includes('delete')) {
      operation = 'delete';
    } else if (tool.name.includes('execute') || tool.name.includes('command')) {
      operation = 'execute';
    }

    // Extract target from common parameter names
    if ('path' in toolUse.params) {
      target = toolUse.params.path as string;
    } else if ('file' in toolUse.params) {
      target = toolUse.params.file as string;
    } else if ('command' in toolUse.params) {
      target = toolUse.params.command as string;
    } else if ('target' in toolUse.params) {
      target = toolUse.params.target as string;
    }

    // Build details string
    if ('content' in toolUse.params) {
      const content = toolUse.params.content as string;
      const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
      details = `Content preview:\n${preview}`;
    } else {
      details = `Parameters: ${JSON.stringify(toolUse.params, null, 2)}`;
    }

    return {
      toolName: tool.name,
      operation,
      target,
      details,
    };
  }

  /**
   * Get all tool definitions for system prompt
   * @returns Array of tool definitions
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Format tool definitions as XML for system prompt
   * @returns String containing XML-formatted tool definitions
   */
  formatToolDefinitionsAsXML(): string {
    const definitions = this.getToolDefinitions();
    
    if (definitions.length === 0) {
      return '';
    }

    let xml = '# Available Tools\n\n';
    xml += 'You have access to the following tools:\n\n';

    for (const tool of definitions) {
      xml += `## ${tool.name}\n\n`;
      xml += `${tool.description}\n\n`;
      xml += '**Parameters:**\n';
      
      if (tool.parameters.length === 0) {
        xml += '- None\n';
      } else {
        for (const param of tool.parameters) {
          const required = param.required ? '(required)' : '(optional)';
          xml += `- \`${param.name}\` (${param.type}) ${required}: ${param.description}\n`;
        }
      }
      
      xml += '\n**Usage:**\n';
      xml += '```xml\n';
      xml += `<${tool.name}>\n`;
      
      for (const param of tool.parameters.filter(p => p.required)) {
        xml += `<${param.name}>value</${param.name}>\n`;
      }
      
      xml += `</${tool.name}>\n`;
      xml += '```\n\n';
    }

    return xml;
  }

  /**
   * Check if a tool exists
   * @param toolName Name of the tool
   * @returns boolean indicating if tool exists
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get count of registered tools
   * @returns Number of registered tools
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Clear all registered tools
   */
  clearTools(): void {
    this.tools.clear();
    console.log('All tools cleared');
  }
}
