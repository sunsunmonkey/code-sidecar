import * as vscode from 'vscode';
import { BaseTool, ParameterDefinition } from './Tool';
import { resolveWorkspacePath } from './pathValidation';

/**
 * ListCodeDefinitionNamesTool - retrieves code definitions (classes, functions, etc.) from a file
 * Requirements: 13.6
 * 
 * This tool retrieves an overview of code definitions in a file using VSCode's
 * document symbol provider. It helps understand the structure of a file without
 * reading the entire content.
 */
export class ListCodeDefinitionNamesTool extends BaseTool {
  readonly name = 'list_code_definition_names';
  readonly description = 'Get an overview of code definitions (classes, functions, methods, variables, etc.) in a file. Returns a hierarchical list of symbols with their types and locations.';
  readonly requiresPermission = false; // Reading code structure doesn't require permission
  
  readonly parameters: ParameterDefinition[] = [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The relative or absolute path to the file to analyze',
    },
  ];

  /**
   * Format symbol kind as string
   */
  private formatSymbolKind(kind: vscode.SymbolKind): string {
    switch (kind) {
      case vscode.SymbolKind.File:
        return 'File';
      case vscode.SymbolKind.Module:
        return 'Module';
      case vscode.SymbolKind.Namespace:
        return 'Namespace';
      case vscode.SymbolKind.Package:
        return 'Package';
      case vscode.SymbolKind.Class:
        return 'Class';
      case vscode.SymbolKind.Method:
        return 'Method';
      case vscode.SymbolKind.Property:
        return 'Property';
      case vscode.SymbolKind.Field:
        return 'Field';
      case vscode.SymbolKind.Constructor:
        return 'Constructor';
      case vscode.SymbolKind.Enum:
        return 'Enum';
      case vscode.SymbolKind.Interface:
        return 'Interface';
      case vscode.SymbolKind.Function:
        return 'Function';
      case vscode.SymbolKind.Variable:
        return 'Variable';
      case vscode.SymbolKind.Constant:
        return 'Constant';
      case vscode.SymbolKind.String:
        return 'String';
      case vscode.SymbolKind.Number:
        return 'Number';
      case vscode.SymbolKind.Boolean:
        return 'Boolean';
      case vscode.SymbolKind.Array:
        return 'Array';
      case vscode.SymbolKind.Object:
        return 'Object';
      case vscode.SymbolKind.Key:
        return 'Key';
      case vscode.SymbolKind.Null:
        return 'Null';
      case vscode.SymbolKind.EnumMember:
        return 'EnumMember';
      case vscode.SymbolKind.Struct:
        return 'Struct';
      case vscode.SymbolKind.Event:
        return 'Event';
      case vscode.SymbolKind.Operator:
        return 'Operator';
      case vscode.SymbolKind.TypeParameter:
        return 'TypeParameter';
      default:
        return 'Unknown';
    }
  }

  /**
   * Format a symbol and its children recursively
   */
  private formatSymbol(symbol: vscode.DocumentSymbol, indent: number = 0): string {
    const indentation = '  '.repeat(indent);
    const kind = this.formatSymbolKind(symbol.kind);
    const line = symbol.range.start.line + 1; // Convert to 1-based
    
    let result = `${indentation}${symbol.name} (${kind}) - Line ${line}\n`;
    
    // Recursively format children
    if (symbol.children && symbol.children.length > 0) {
      for (const child of symbol.children) {
        result += this.formatSymbol(child, indent + 1);
      }
    }
    
    return result;
  }

  /**
   * Execute the list_code_definition_names tool
   * Requirements: 13.6
   */
  async execute(params: Record<string, unknown>): Promise<string> {
    const filePath = params.path as string;
    
    try {
      // Validate and resolve the file path
      const uri = vscode.Uri.file(resolveWorkspacePath(filePath));
      
      // Check if file exists
      try {
        await vscode.workspace.fs.stat(uri);
      } catch (error) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Open the document (required for symbol provider)
      const document = await vscode.workspace.openTextDocument(uri);
      
      // Get document symbols
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        uri
      );
      
      if (!symbols || symbols.length === 0) {
        return `No code definitions found in file: ${filePath}\n\nThis could mean:\n- The file is empty\n- The language doesn't support symbol extraction\n- No symbols are defined in the file`;
      }
      
      // Format the results
      let result = `Code definitions in ${filePath}:\n`;
      result += `${'='.repeat(filePath.length + 22)}\n\n`;
      
      // Count symbols by type
      const symbolCounts: Map<string, number> = new Map();
      const countSymbols = (symbol: vscode.DocumentSymbol) => {
        const kind = this.formatSymbolKind(symbol.kind);
        symbolCounts.set(kind, (symbolCounts.get(kind) || 0) + 1);
        if (symbol.children) {
          symbol.children.forEach(countSymbols);
        }
      };
      symbols.forEach(countSymbols);
      
      // Format all symbols
      for (const symbol of symbols) {
        result += this.formatSymbol(symbol);
      }
      
      // Add summary
      result += '\nSummary:\n';
      const sortedCounts = Array.from(symbolCounts.entries()).sort((a, b) => b[1] - a[1]);
      for (const [kind, count] of sortedCounts) {
        result += `  ${kind}: ${count}\n`;
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('Access denied')) {
        throw error; // Re-throw security errors
      }
      
      throw new Error(`Failed to list code definitions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
