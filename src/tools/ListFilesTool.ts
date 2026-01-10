import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool, ParameterDefinition } from './Tool';
import { resolveWorkspacePath } from './pathValidation';

/**
 * ListFilesTool - lists directory contents with optional recursion
 * Requirements: 13.4
 * 
 * This tool lists the contents of a directory, optionally recursively.
 * It includes security checks to prevent path traversal attacks.
 */
export class ListFilesTool extends BaseTool {
  readonly name = 'list_files';
  readonly description = 'List the contents of a directory. Can optionally list recursively to show the entire directory tree.';
  readonly requiresPermission = false; // Listing is generally safe
  
  readonly parameters: ParameterDefinition[] = [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The relative or absolute path to the directory to list. Use "." for the workspace root.',
    },
    {
      name: 'recursive',
      type: 'boolean',
      required: false,
      description: 'Whether to list files recursively (default: false)',
    },
  ];

  /**
   * List directory contents non-recursively
   */
  private async listDirectory(dirPath: string): Promise<string[]> {
   const uri = vscode.Uri.file(dirPath);
    const entries = await vscode.workspace.fs.readDirectory(uri);
    
    const result: string[] = [];
    
    for (const [name, type] of entries) {
      if (type === vscode.FileType.Directory) {
        result.push(`${name}/`);
      } else if (type === vscode.FileType.File) {
        result.push(name);
      } else if (type === vscode.FileType.SymbolicLink) {
        result.push(`${name} -> (symlink)`);
      }
    }
    
    return result.sort();
  }

  /**
   * List directory contents recursively
   */
  private async listDirectoryRecursive(dirPath: string, prefix: string = ''): Promise<string[]> {
    const uri = vscode.Uri.file(dirPath);
    const entries = await vscode.workspace.fs.readDirectory(uri);
    
    const result: string[] = [];
    
    // Sort entries: directories first, then files
    const sortedEntries = entries.sort((a, b) => {
      if (a[1] === vscode.FileType.Directory && b[1] !== vscode.FileType.Directory) {
        return -1;
      }
      if (a[1] !== vscode.FileType.Directory && b[1] === vscode.FileType.Directory) {
        return 1;
      }
      return a[0].localeCompare(b[0]);
    });
    
    for (const [name, type] of sortedEntries) {
      const fullPath = path.join(dirPath, name);
      
      if (type === vscode.FileType.Directory) {
        result.push(`${prefix}${name}/`);
        // Recursively list subdirectory
        const subResults = await this.listDirectoryRecursive(fullPath, `${prefix}  `);
        result.push(...subResults);
      } else if (type === vscode.FileType.File) {
        result.push(`${prefix}${name}`);
      } else if (type === vscode.FileType.SymbolicLink) {
        result.push(`${prefix}${name} -> (symlink)`);
      }
    }
    
    return result;
  }

  /**
   * Normalize recursive flag, allowing string values from XML parsing
   */
  private normalizeRecursive(recursive: unknown): boolean {
    if (typeof recursive === 'boolean' || recursive === undefined) {
      return recursive === true;
    }

    if (typeof recursive === 'string') {
      const value = recursive.trim().toLowerCase();
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
    }

    throw new Error('Invalid recursive flag');
  }

  override validate(params: Record<string, unknown>): boolean {
    if (!params || typeof params.path !== 'string') {
      return false;
    }

    try {
      if ('recursive' in params) {
        params.recursive = this.normalizeRecursive(params.recursive);
      }
    } catch {
      return false;
    }

    return super.validate(params);
  }

  /**
   * Execute the list_files tool
   * Requirements: 13.4
   */
  async execute(params: Record<string, unknown>): Promise<string> {
    const dirPath = params.path as string;
    const recursive = this.normalizeRecursive(params.recursive);
    
    try {
      // Validate and normalize the path
      const validatedPath = resolveWorkspacePath(dirPath);
      
      // Check if path exists and is a directory
      const uri = vscode.Uri.file(validatedPath);
      const stat = await vscode.workspace.fs.stat(uri);
      
      if (stat.type !== vscode.FileType.Directory) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }
      
      // List directory contents
      let entries: string[];
      if (recursive) {
        entries = await this.listDirectoryRecursive(validatedPath);
      } else {
        entries = await this.listDirectory(validatedPath);
      }
      
      if (entries.length === 0) {
        return `Directory is empty: ${dirPath}`;
      }
      
      // Format the result
      const header = recursive 
        ? `Directory listing (recursive): ${dirPath}\n`
        : `Directory listing: ${dirPath}\n`;
      
      return header + entries.join('\n');
      
    } catch (error) {
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('Access denied')) {
          throw error; // Re-throw security errors
        }
        if (error.message.includes('Path is not a directory')) {
          throw error; // Re-throw directory check errors
        }
        if (error.message.includes('ENOENT') || error.message.includes('FileNotFound')) {
          throw new Error(`Directory not found: ${dirPath}`);
        }
        if (error.message.includes('EACCES') || error.message.includes('permission')) {
          throw new Error(`Permission denied: Cannot list directory ${dirPath}`);
        }
      }
      
      throw new Error(`Failed to list directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
