import { BaseTool, ParameterDefinition } from './Tool';

/**
 * AttemptCompletionTool - marks a task as complete
 * Requirements: 6.6, 13.1
 * 
 * This tool is used by the LLM to signal that it has completed the user's request.
 * When this tool is called, the ReAct loop should terminate.
 */
export class AttemptCompletionTool extends BaseTool {
  readonly name = 'attempt_completion';
  readonly description = 'Use this tool when you have completed the task and want to present the final result to the user. This will end the current task execution.';
  readonly requiresPermission = false;
  
  readonly parameters: ParameterDefinition[] = [
    {
      name: 'result',
      type: 'string',
      required: true,
      description: 'A summary of what was accomplished and the final result of the task',
    },
  ];

  /**
   * Execute the attempt_completion tool
   * Requirements: 6.6, 13.1
   * 
   * @param params Tool parameters containing the result summary
   * @returns Promise<string> Formatted completion message
   */
  async execute(params: Record<string, unknown>): Promise<string> {
    const result = params.result as string;
    
    // Validate that result is not empty
    if (!result || result.trim().length === 0) {
      throw new Error('Result parameter cannot be empty');
    }
    
    // Format the completion message
    return `Task completed successfully.\n\nResult:\n${result}`;
  }
}
