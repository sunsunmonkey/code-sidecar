import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool, ParameterDefinition } from './Tool';

/**
 * WriteFileTool - writes content to a file, creating directories as needed
 * Requirements: 13.2
 * 
 * This tool writes content to a file. It will create parent directories if they don't exist.
 * It includes security checks to prevent path traversal attacks.
 * This tool requires user permission before execution.
 */
export class WriteFileTool extends BaseTool {
  readonly name = 'write_file';
  readonly description = 'Write content to a file. Creates the file if it does not exist, and creates parent directories as needed. Overwrites existing files.';
  readonly requiresPermission = true; // Writing requires permission
  
  readonly parameters: ParameterDefinition[] = [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The relative or absolute path to the file to write',
    },
    {
      name: 'content',
      type: 'string',
      required: true,
      description: 'The content to write to the file',
    },
  ];



  /**
   * Validate and normalize file path to prevent path traversal attacks
   * Requirements: 13.4
   */
  private validatePath(filePath: string): string {
    // Get workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder is open');
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    
    // Resolve the path relative to workspace root
    const resolvedPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(workspaceRoot, filePath);
    
    // Normalize the path to resolve .. and .
    const normalizedPath = path.normalize(resolvedPath);
    
    // Check if the normalized path is within the workspace
    if (!normalizedPath.startsWith(workspaceRoot)) {
      throw new Error(`Access denied: Path '${filePath}' is outside the workspace`);
    }
    
    return normalizedPath;
  }

  /**
   * Create parent directories if they don't exist
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dirPath = path.dirname(filePath);
    const dirUri = vscode.Uri.file(dirPath);
    
    try {
      // Try to stat the directory
      await vscode.workspace.fs.stat(dirUri);
    } catch (error) {
      // Directory doesn't exist, create it
      await vscode.workspace.fs.createDirectory(dirUri);
    }
  }

  /**
   * Execute the write_file tool
   * Requirements: 13.2, 13.4
   */
  async execute(params: Record<string, any>): Promise<string> {
    const filePath = params.path as string;
    const content = params.content as string;
    
    try {
      // Validate and normalize the path
      const validatedPath = this.validatePath(filePath);
      
      // Ensure parent directories exist
      await this.ensureDirectoryExists(validatedPath);
      
      // Write the file using VSCode API
      const uri = vscode.Uri.file(validatedPath);
      const contentBuffer = Buffer.from(content, 'utf-8');
      await vscode.workspace.fs.writeFile(uri, contentBuffer);
      
      // Count lines for feedback
      const lineCount = content.split('\n').length;
      const charCount = content.length;
      
      return `Successfully wrote to file: ${filePath}\n${lineCount} lines, ${charCount} characters`;
      
    } catch (error) {
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('Access denied')) {
          throw error; // Re-throw security errors
        }
        if (error.message.includes('EACCES') || error.message.includes('permission')) {
          throw new Error(`Permission denied: Cannot write to file ${filePath}`);
        }
        if (error.message.includes('ENOSPC')) {
          throw new Error(`No space left on device: Cannot write to file ${filePath}`);
        }
      }
      
      throw new Error(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
