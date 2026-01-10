/**
 * Parameter definition for a tool
 */
export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
}

/**
 * Tool definition for system prompt
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
}

/**
 * Base interface for all tools
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */
export interface Tool {
  /**
   * Tool name (used in tool calls)
   */
  readonly name: string;

  /**
   * Tool description (shown to LLM)
   */
  readonly description: string;

  /**
   * Parameter definitions
   */
  readonly parameters: ParameterDefinition[];

  /**
   * Whether this tool requires user permission
   */
  readonly requiresPermission: boolean;

  /**
   * Execute the tool with given parameters
   * @param params Tool parameters
   * @returns Promise<string> Tool execution result
   */
  execute(params: Record<string, unknown>): Promise<string>;

  /**
   * Validate tool parameters
   * @param params Tool parameters
   * @returns boolean indicating if parameters are valid
   */
  validate(params: Record<string, unknown>): boolean;
}

/**
 * Abstract base class for tools with common validation logic
 */
export abstract class BaseTool implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ParameterDefinition[];
  abstract readonly requiresPermission: boolean;

  abstract execute(params: Record<string, unknown>): Promise<string>;

  /**
   * Validate parameters against parameter definitions
   * Requirements: 13.7
   */
  validate(params: Record<string, unknown>): boolean {
    // Check all required parameters are present
    for (const param of this.parameters) {
      if (param.required && !(param.name in params)) {
        return false;
      }
    }

    // Check parameter types
    for (const [key, value] of Object.entries(params)) {
      const paramDef = this.parameters.find(p => p.name === key);
      if (!paramDef) {
        continue; // Allow extra parameters
      }

      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (paramDef.type === 'object' && actualType !== 'object') {
        return false;
      }
      if (paramDef.type !== 'object' && paramDef.type !== actualType) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get tool definition for system prompt
   */
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }
}
