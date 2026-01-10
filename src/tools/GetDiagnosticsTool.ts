import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool, ParameterDefinition } from './Tool';
import { resolveWorkspacePath } from './pathValidation';

/**
 * GetDiagnosticsTool - retrieves VSCode diagnostic information (errors, warnings)
 * Requirements: 13.6
 * 
 * This tool retrieves compilation errors, warnings, and other diagnostic information
 * from VSCode's language services. It can get diagnostics for a specific file or all files.
 */
export class GetDiagnosticsTool extends BaseTool {
  readonly name = 'get_diagnostics';
  readonly description = 'Get diagnostic information (errors, warnings, hints) from VSCode language services. Can retrieve diagnostics for a specific file or all files in the workspace.';
  readonly requiresPermission = false; // Reading diagnostics doesn't require permission
  
  readonly parameters: ParameterDefinition[] = [
    {
      name: 'filePath',
      type: 'string',
      required: false,
      description: 'Optional file path to get diagnostics for. If not provided, returns diagnostics for all files.',
    },
  ];

  /**
   * Format diagnostic severity as string
   */
  private formatSeverity(severity: vscode.DiagnosticSeverity): string {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 'ERROR';
      case vscode.DiagnosticSeverity.Warning:
        return 'WARNING';
      case vscode.DiagnosticSeverity.Information:
        return 'INFO';
      case vscode.DiagnosticSeverity.Hint:
        return 'HINT';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Format a single diagnostic entry
   */
  private formatDiagnostic(uri: vscode.Uri, diagnostic: vscode.Diagnostic): string {
    const severity = this.formatSeverity(diagnostic.severity);
    const line = diagnostic.range.start.line + 1; // Convert to 1-based
    const column = diagnostic.range.start.character + 1;
    const source = diagnostic.source ? `[${diagnostic.source}]` : '';
    const code = diagnostic.code ? ` (${diagnostic.code})` : '';
    
    let result = `${severity} ${source}${code} at line ${line}, column ${column}:\n`;
    result += `  ${diagnostic.message}\n`;
    
    // Add related information if available
    if (diagnostic.relatedInformation && diagnostic.relatedInformation.length > 0) {
      result += `  Related:\n`;
      for (const related of diagnostic.relatedInformation) {
        const relatedFile = path.basename(related.location.uri.fsPath);
        const relatedLine = related.location.range.start.line + 1;
        result += `    - ${relatedFile}:${relatedLine}: ${related.message}\n`;
      }
    }
    
    return result;
  }

  /**
   * Execute the get_diagnostics tool
   * Requirements: 13.6
   */
  async execute(params: Record<string, unknown>): Promise<string> {
    const filePath = params.filePath as string | undefined;
    
    try {
      let diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
      
      if (filePath) {
        // Get diagnostics for specific file
        const uri = vscode.Uri.file(resolveWorkspacePath(filePath));
        const diagnostics = vscode.languages.getDiagnostics(uri);
        
        if (diagnostics.length > 0) {
          diagnosticsMap.set(uri.fsPath, diagnostics);
        }
      } else {
        // Get diagnostics for all files
        const allDiagnostics = vscode.languages.getDiagnostics();
        
        for (const [uri, diagnostics] of allDiagnostics) {
          if (diagnostics.length > 0) {
            diagnosticsMap.set(uri.fsPath, diagnostics);
          }
        }
      }
      
      // Format the results
      if (diagnosticsMap.size === 0) {
        return filePath 
          ? `No diagnostics found for file: ${filePath}`
          : 'No diagnostics found in the workspace.';
      }
      
      let result = filePath 
        ? `Diagnostics for ${filePath}:\n\n`
        : `Diagnostics for ${diagnosticsMap.size} file(s):\n\n`;
      
      // Count diagnostics by severity
      let errorCount = 0;
      let warningCount = 0;
      let infoCount = 0;
      let hintCount = 0;
      
      for (const [filePath, diagnostics] of diagnosticsMap) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
        const relativePath = path.relative(workspaceRoot, filePath) || filePath;
        
        result += `File: ${relativePath}\n`;
        result += `${'='.repeat(relativePath.length + 6)}\n`;
        
        for (const diagnostic of diagnostics) {
          // Count by severity
          switch (diagnostic.severity) {
            case vscode.DiagnosticSeverity.Error:
              errorCount++;
              break;
            case vscode.DiagnosticSeverity.Warning:
              warningCount++;
              break;
            case vscode.DiagnosticSeverity.Information:
              infoCount++;
              break;
            case vscode.DiagnosticSeverity.Hint:
              hintCount++;
              break;
          }
          
          result += this.formatDiagnostic(vscode.Uri.file(filePath), diagnostic);
        }
        
        result += '\n';
      }
      
      // Add summary
      result += `Summary: ${errorCount} error(s), ${warningCount} warning(s), ${infoCount} info(s), ${hintCount} hint(s)\n`;
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to get diagnostics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
