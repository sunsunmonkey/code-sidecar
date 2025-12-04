import * as vscode from "vscode";
import * as path from "path";

/**
 * Diagnostic information from VSCode
 */
export interface DiagnosticInfo {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  code?: string;
}

/**
 * File node in project tree
 */
export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

/**
 * Project context information
 */
export interface ProjectContext {
  // Current active file
  activeFile?: {
    path: string;
    content: string;
    language: string;
  };

  // Selected code
  selection?: {
    text: string;
    startLine: number;
    endLine: number;
  };

  // Cursor position
  cursorPosition?: {
    line: number;
    character: number;
  };

  // Diagnostics (errors, warnings)
  diagnostics?: DiagnosticInfo[];

  // Project file tree
  fileTree?: FileNode[];
}

/**
 * ContextCollector collects project context information
 */
export class ContextCollector {
  private readonly MAX_CONTEXT_SIZE = 100000; // Maximum context size in characters
  private readonly MAX_FILE_SIZE = 50000; // Maximum single file size in characters
  private readonly MAX_FILES_IN_TREE = 500; // Maximum files to include in tree

  /**
   * Collect current project context
   */
  async collectContext(): Promise<ProjectContext> {
    const context: ProjectContext = {};

    try {
      // Collect active file and selection (Requirement 8.1)
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;

        // Collect active file
        const content = document.getText();
        if (content.length <= this.MAX_FILE_SIZE) {
          context.activeFile = {
            path: this.getRelativePath(document.uri.fsPath),
            content: content,
            language: document.languageId,
          };
        } else {
          // File too large, truncate with message
          context.activeFile = {
            path: this.getRelativePath(document.uri.fsPath),
            content: `[File too large (${
              content.length
            } chars). Showing first ${
              this.MAX_FILE_SIZE
            } chars]\n${content.substring(0, this.MAX_FILE_SIZE)}`,
            language: document.languageId,
          };
        }

        // Collect selection (Requirement 8.1)
        const selection = editor.selection;
        if (!selection.isEmpty) {
          const selectedText = document.getText(selection);
          context.selection = {
            text: selectedText,
            startLine: selection.start.line + 1, // 1-indexed
            endLine: selection.end.line + 1,
          };
        }

        // Collect cursor position (Requirement 8.1)
        context.cursorPosition = {
          line: selection.active.line + 1, // 1-indexed
          character: selection.active.character + 1,
        };
      }

      // Collect diagnostics (Requirement 8.1)
      context.diagnostics = await this.collectDiagnostics();

      // Collect project file tree (Requirement 8.1)
      context.fileTree = await this.collectFileTree();
    } catch (error) {
      console.error("[ContextCollector] Error collecting context:", error);
    }

    return context;
  }

  /**
   * Collect context for a specific file
   * Requirements: 8.2, 8.5
   */
  async collectFileContext(filePath: string): Promise<string> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return `[Error: No workspace folder open]`;
      }

      // Resolve file path
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolders[0].uri.fsPath, filePath);

      const uri = vscode.Uri.file(absolutePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();

      // Apply size limit (Requirement 8.3)
      if (content.length > this.MAX_FILE_SIZE) {
        return `[File: ${filePath}]\n[File too large (${
          content.length
        } chars). Showing first ${
          this.MAX_FILE_SIZE
        } chars]\n${content.substring(0, this.MAX_FILE_SIZE)}`;
      }

      return `[File: ${filePath}]\n${content}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `[Error reading file ${filePath}: ${errorMessage}]`;
    }
  }

  /**
   * Collect diagnostic information
   * Requirements: 8.1
   */
  async collectDiagnostics(): Promise<DiagnosticInfo[]> {
    const diagnostics: DiagnosticInfo[] = [];

    try {
      const allDiagnostics = vscode.languages.getDiagnostics();

      for (const [uri, uriDiagnostics] of allDiagnostics) {
        const relativePath = this.getRelativePath(uri.fsPath);

        for (const diagnostic of uriDiagnostics) {
          diagnostics.push({
            file: relativePath,
            line: diagnostic.range.start.line + 1, // 1-indexed
            column: diagnostic.range.start.character + 1,
            severity: this.mapSeverity(diagnostic.severity),
            message: diagnostic.message,
            code: diagnostic.code?.toString(),
          });
        }
      }

      // Limit number of diagnostics to avoid overwhelming context
      return diagnostics.slice(0, 50);
    } catch (error) {
      console.error("[ContextCollector] Error collecting diagnostics:", error);
      return [];
    }
  }

  /**
   * Collect project file tree
   * Requirements: 8.1, 8.3
   */
  async collectFileTree(): Promise<FileNode[]> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return [];
      }

      const rootFolder = workspaceFolders[0];
      const fileCount = { count: 0 };
      const tree = await this.buildFileTree(
        rootFolder.uri,
        rootFolder.name,
        fileCount
      );

      return tree ? [tree] : [];
    } catch (error) {
      console.error("[ContextCollector] Error collecting file tree:", error);
      return [];
    }
  }

  /**
   * Build file tree recursively
   * Requirements: 8.1, 8.3
   */
  private async buildFileTree(
    uri: vscode.Uri,
    name: string,
    fileCount: { count: number }
  ): Promise<FileNode | null> {
    // Check file count limit (Requirement 8.3)
    if (fileCount.count >= this.MAX_FILES_IN_TREE) {
      return null;
    }

    try {
      const stat = await vscode.workspace.fs.stat(uri);

      if (stat.type === vscode.FileType.File) {
        fileCount.count++;
        return {
          name: name,
          path: this.getRelativePath(uri.fsPath),
          type: "file",
        };
      } else if (stat.type === vscode.FileType.Directory) {
        // Skip common directories that should be ignored
        if (this.shouldIgnoreDirectory(name)) {
          return null;
        }

        const children: FileNode[] = [];
        const entries = await vscode.workspace.fs.readDirectory(uri);

        for (const [entryName, entryType] of entries) {
          if (fileCount.count >= this.MAX_FILES_IN_TREE) {
            break;
          }

          const entryUri = vscode.Uri.joinPath(uri, entryName);
          const childNode = await this.buildFileTree(
            entryUri,
            entryName,
            fileCount
          );

          if (childNode) {
            children.push(childNode);
          }
        }

        return {
          name: name,
          path: this.getRelativePath(uri.fsPath),
          type: "directory",
          children: children.length > 0 ? children : undefined,
        };
      }
    } catch (error) {
      console.error(`[ContextCollector] Error reading ${uri.fsPath}:`, error);
    }

    return null;
  }

  /**
   * Check if directory should be ignored
   */
  private shouldIgnoreDirectory(name: string): boolean {
    const ignoredDirs = [
      "node_modules",
      ".git",
      ".vscode",
      "dist",
      "build",
      "out",
      ".next",
      ".nuxt",
      "coverage",
      ".cache",
      ".temp",
      ".tmp",
      "__pycache__",
      ".pytest_cache",
      ".mypy_cache",
      "venv",
      ".venv",
      "env",
      ".env",
    ];

    return ignoredDirs.includes(name) || name.startsWith(".");
  }

  /**
   * Get relative path from workspace root
   */
  private getRelativePath(absolutePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return absolutePath;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    if (absolutePath.startsWith(workspaceRoot)) {
      return path.relative(workspaceRoot, absolutePath);
    }

    return absolutePath;
  }

  /**
   * Map VSCode diagnostic severity to string
   */
  private mapSeverity(
    severity: vscode.DiagnosticSeverity | undefined
  ): "error" | "warning" | "info" | "hint" {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return "error";
      case vscode.DiagnosticSeverity.Warning:
        return "warning";
      case vscode.DiagnosticSeverity.Information:
        return "info";
      case vscode.DiagnosticSeverity.Hint:
        return "hint";
      default:
        return "info";
    }
  }

  /**
   * Format context as string for inclusion in messages
   * Requirements: 8.3, 8.4
   */
  formatContext(context: ProjectContext): string {
    const parts: string[] = [];

    // Add active file
    if (context.activeFile) {
      parts.push(`## Current File: ${context.activeFile.path}`);
      parts.push(`Language: ${context.activeFile.language}`);
      parts.push(`\`\`\`${context.activeFile.language}`);
      parts.push(context.activeFile.content);
      parts.push("```");
    }

    // Add selection
    if (context.selection) {
      parts.push(
        `\n## Selected Code (lines ${context.selection.startLine}-${context.selection.endLine}):`
      );
      parts.push("```");
      parts.push(context.selection.text);
      parts.push("```");
    }

    // Add cursor position
    if (context.cursorPosition) {
      parts.push(
        `\n## Cursor Position: Line ${context.cursorPosition.line}, Column ${context.cursorPosition.character}`
      );
    }

    // Add diagnostics
    if (context.diagnostics && context.diagnostics.length > 0) {
      parts.push(`\n## Diagnostics (${context.diagnostics.length}):`);
      for (const diag of context.diagnostics.slice(0, 20)) {
        // Limit to 20
        parts.push(
          `- [${diag.severity.toUpperCase()}] ${diag.file}:${diag.line}:${
            diag.column
          } - ${diag.message}`
        );
      }
      if (context.diagnostics.length > 20) {
        parts.push(`... and ${context.diagnostics.length - 20} more`);
      }
    }

    // Add file tree (simplified)
    if (context.fileTree && context.fileTree.length > 0) {
      parts.push(`\n## Project Structure:`);
      parts.push(this.formatFileTree(context.fileTree, 0, 3)); // Max depth 3
    }

    const formatted = parts.join("\n");

    // Apply size limit (Requirement 8.3)
    if (formatted.length > this.MAX_CONTEXT_SIZE) {
      return (
        formatted.substring(0, this.MAX_CONTEXT_SIZE) +
        `\n\n[Context truncated: exceeded ${this.MAX_CONTEXT_SIZE} characters]`
      );
    }

    return formatted;
  }

  /**
   * Format file tree as string
   */
  private formatFileTree(
    nodes: FileNode[],
    depth: number,
    maxDepth: number
  ): string {
    if (depth >= maxDepth) {
      return "";
    }

    const indent = "  ".repeat(depth);
    const lines: string[] = [];

    for (const node of nodes) {
      if (node.type === "directory") {
        lines.push(`${indent}📁 ${node.name}/`);
        if (node.children && node.children.length > 0) {
          lines.push(this.formatFileTree(node.children, depth + 1, maxDepth));
        }
      } else {
        lines.push(`${indent}📄 ${node.name}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Truncate context intelligently to fit size limit
   * Requirements: 8.3
   */
  truncateContext(context: ProjectContext): ProjectContext {
    const truncated = { ...context };

    // Priority: active file > selection > diagnostics > file tree
    let currentSize = 0;

    // Always include active file (truncated if needed)
    if (truncated.activeFile) {
      const fileSize = truncated.activeFile.content.length;
      if (fileSize > this.MAX_FILE_SIZE) {
        truncated.activeFile.content =
          truncated.activeFile.content.substring(0, this.MAX_FILE_SIZE) +
          "\n[... truncated]";
      }
      currentSize += truncated.activeFile.content.length;
    }

    // Include selection if space allows
    if (truncated.selection) {
      currentSize += truncated.selection.text.length;
    }

    // Limit diagnostics if needed
    if (truncated.diagnostics && currentSize < this.MAX_CONTEXT_SIZE) {
      const remainingSize = this.MAX_CONTEXT_SIZE - currentSize;
      const avgDiagSize = 100; // Estimated average diagnostic size
      const maxDiags = Math.floor(remainingSize / avgDiagSize);
      truncated.diagnostics = truncated.diagnostics.slice(0, maxDiags);
    }

    // Remove file tree if context is too large
    if (currentSize > this.MAX_CONTEXT_SIZE * 0.8) {
      truncated.fileTree = undefined;
    }

    return truncated;
  }
}
