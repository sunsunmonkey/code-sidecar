import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool, ParameterDefinition } from './Tool';


/**
 * InsertContentTool - inserts content at a specific line in a file
 * Requirements: 13.3
 * 
 * This tool inserts content at a specified line number in a file.
 * Line numbers are 1-based (first line is line 1).
 * The content is inserted before the specified line.
 * This tool requires user permission before execution.
 */
export class InsertContentTool extends BaseTool {
  readonly name = 'insert_content';
  readonly description = 'Insert content at a specific line number in a file. Line numbers are 1-based. Content is inserted before the specified line.';
  readonly requiresPermission = true; // Modifying files requires permission
  
  readonly parameters: ParameterDefinition[] = [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The relative or absolute path to the file to edit',
    },
    {
      name: 'line',
      type: 'number',
      required: true,
      description: 'The line number where content should be inserted (1-based). Content is inserted before this line.',
    },
    {
      name: 'content',
      type: 'string',
      required: true,
      description: 'The content to insert. Can be multiple lines.',
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
   * Execute the insert_content tool
   * Requirements: 13.3
   */
  async execute(params: Record<string, any>): Promise<string> {
    const filePath = params.path as string;
    const lineNumber = params.line as number;
    const content = params.content as string;
    
    try {
      // Validate line number
      if (!Number.isInteger(lineNumber) || lineNumber < 1) {
        throw new Error(`Invalid line number: ${lineNumber}. Line numbers must be positive integers (1-based).`);
      }
      
      // Validate and normalize the path
      const validatedPath = this.validatePath(filePath);
      
      // Read the file
      const uri = vscode.Uri.file(validatedPath);
      const fileContent = await vscode.workspace.fs.readFile(uri);
      const originalContent = Buffer.from(fileContent).toString('utf-8');
      
      // Split into lines
      const lines = originalContent.split('\n');
      const totalLines = lines.length;
      
      // Validate line number is within bounds
      // Allow inserting at totalLines + 1 (append to end)
      if (lineNumber > totalLines + 1) {
        throw new Error(
          `Line number ${lineNumber} is out of bounds. File has ${totalLines} lines. ` +
          `You can insert at lines 1 to ${totalLines + 1}.`
        );
      }
      
      // Insert content at the specified line (convert to 0-based index)
      const insertIndex = lineNumber - 1;
      
      // Ensure content ends with newline if not inserting at the very end
      let contentToInsert = content;
      if (insertIndex < totalLines && !content.endsWith('\n')) {
        contentToInsert = content + '\n';
      }
      
      // Split content into lines for insertion
      const contentLines = contentToInsert.split('\n');
      
      // Insert the content
      lines.splice(insertIndex, 0, ...contentLines.slice(0, -1));
      if (contentLines[contentLines.length - 1] !== '') {
        lines.splice(insertIndex + contentLines.length - 1, 0, contentLines[contentLines.length - 1]);
      }
      
      // Join back into content
      const newContent = lines.join('\n');
      
      // Write the modified content back
      const newContentBuffer = Buffer.from(newContent, 'utf-8');
      await vscode.workspace.fs.writeFile(uri, newContentBuffer);
      
      // Calculate statistics for feedback
      const linesInserted = content.split('\n').length;
      const newTotalLines = newContent.split('\n').length;
      
      return (
        `Successfully inserted content into file: ${filePath}\n` +
        `Inserted ${linesInserted} line(s) at line ${lineNumber}\n` +
        `File now has ${newTotalLines} lines (was ${totalLines})`
      );
      
    } catch (error) {
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('Access denied')) {
          throw error; // Re-throw security errors
        }
        if (error.message.includes('Invalid line number') || 
            error.message.includes('out of bounds')) {
          throw error; // Re-throw validation errors
        }
        if (error.message.includes('ENOENT') || error.message.includes('FileNotFound')) {
          throw new Error(`File not found: ${filePath}`);
        }
        if (error.message.includes('EACCES') || error.message.includes('permission')) {
          throw new Error(`Permission denied: Cannot modify file ${filePath}`);
        }
      }
      
      throw new Error(`Failed to insert content into ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
