import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool, ParameterDefinition } from './Tool';

/**
 * SearchFilesTool - searches files using regular expressions with context
 * Requirements: 13.5
 * 
 * This tool searches for text patterns in files using regular expressions.
 * It returns matches with surrounding context lines for better understanding.
 * Supports filtering by file patterns (e.g., "*.ts" for TypeScript files).
 */
export class SearchFilesTool extends BaseTool {
  readonly name = 'search_files';
  readonly description = 'Search for text patterns in files using regular expressions. Returns matches with surrounding context lines.';
  readonly requiresPermission = false; // Searching is generally safe
  
  readonly parameters: ParameterDefinition[] = [
    {
      name: 'pattern',
      type: 'string',
      required: true,
      description: 'The regular expression pattern to search for',
    },
    {
      name: 'file_pattern',
      type: 'string',
      required: false,
      description: 'Optional glob pattern to filter files (e.g., "*.ts", "src/**/*.js"). Defaults to all files.',
    },
    {
      name: 'case_sensitive',
      type: 'boolean',
      required: false,
      description: 'Whether the search should be case-sensitive (default: false)',
    },
    {
      name: 'context_lines',
      type: 'number',
      required: false,
      description: 'Number of context lines to show before and after each match (default: 2)',
    },
  ];

  /**
   * Search files in the workspace
   * Requirements: 13.5
   */
  async execute(params: Record<string, unknown>): Promise<string> {
    const pattern = params.pattern as string;
    const filePattern = (params.file_pattern as string) || '**/*';
    const caseSensitive = params.case_sensitive === true;
    const contextLines = typeof params.context_lines === 'number' ? params.context_lines : 2;
    
    try {
      // Validate context lines
      if (contextLines < 0 || contextLines > 10) {
        throw new Error(`Invalid context_lines: ${contextLines}. Must be between 0 and 10.`);
      }
      
      // Validate regex pattern
      let regex: RegExp;
      try {
        const flags = caseSensitive ? 'g' : 'gi';
        regex = new RegExp(pattern, flags);
      } catch (error) {
        throw new Error(`Invalid regular expression pattern: ${pattern}`);
      }
      
      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
      }
      
      // Find files matching the file pattern
      const files = await vscode.workspace.findFiles(
        filePattern,
        '**/node_modules/**' // Exclude node_modules by default
      );
      
      if (files.length === 0) {
        return `No files found matching pattern: ${filePattern}`;
      }
      
      // Search each file
      const results: string[] = [];
      let totalMatches = 0;
      let filesWithMatches = 0;
      
      for (const fileUri of files) {
        try {
          // Read file content
          const fileContent = await vscode.workspace.fs.readFile(fileUri);
          const content = Buffer.from(fileContent).toString('utf-8');
          const lines = content.split('\n');
          
          // Find matches in this file
          const fileMatches: string[] = [];
          const matchedLines = new Set<number>();
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const matches = line.match(regex);
            
            if (matches && matches.length > 0) {
              matchedLines.add(i);
              totalMatches += matches.length;
            }
          }
          
          // If we found matches, format them with context
          if (matchedLines.size > 0) {
            filesWithMatches++;
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            fileMatches.push(`\n=== ${relativePath} (${matchedLines.size} matching lines) ===`);
            
            // Group nearby matches to avoid duplicate context
            const matchGroups: number[][] = [];
            const sortedMatches = Array.from(matchedLines).sort((a, b) => a - b);
            
            let currentGroup: number[] = [sortedMatches[0]];
            for (let i = 1; i < sortedMatches.length; i++) {
              const prevLine = sortedMatches[i - 1];
              const currLine = sortedMatches[i];
              
              // If lines are close (within 2 * contextLines), group them
              if (currLine - prevLine <= 2 * contextLines + 1) {
                currentGroup.push(currLine);
              } else {
                matchGroups.push(currentGroup);
                currentGroup = [currLine];
              }
            }
            matchGroups.push(currentGroup);
            
            // Format each group with context
            for (const group of matchGroups) {
              const startLine = Math.max(0, group[0] - contextLines);
              const endLine = Math.min(lines.length - 1, group[group.length - 1] + contextLines);
              
              for (let i = startLine; i <= endLine; i++) {
                const lineNum = i + 1; // 1-based line numbers
                const isMatch = matchedLines.has(i);
                const prefix = isMatch ? '> ' : '  ';
                fileMatches.push(`${prefix}${lineNum}: ${lines[i]}`);
              }
              
              // Add separator between groups
              if (group !== matchGroups[matchGroups.length - 1]) {
                fileMatches.push('  ...');
              }
            }
            
            results.push(fileMatches.join('\n'));
          }
          
        } catch (error) {
          // Skip files that can't be read (binary files, permission issues, etc.)
          continue;
        }
      }
      
      // Format final result
      if (results.length === 0) {
        return (
          `No matches found for pattern: ${pattern}\n` +
          `Searched ${files.length} file(s) matching: ${filePattern}`
        );
      }
      
      const summary = (
        `Found ${totalMatches} match(es) in ${filesWithMatches} file(s)\n` +
        `Pattern: ${pattern}\n` +
        `File pattern: ${filePattern}\n` +
        `Case sensitive: ${caseSensitive}\n`
      );
      
      return summary + results.join('\n');
      
    } catch (error) {
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('Invalid regular expression') ||
            error.message.includes('Invalid context_lines')) {
          throw error; // Re-throw validation errors
        }
      }
      
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
