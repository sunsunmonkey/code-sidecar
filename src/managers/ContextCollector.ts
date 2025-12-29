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

  // AGENTS.md instructions
  agentInstructions?: {
    path: string;
    content: string;
  };
}

/**
 * ContextCollector collects project context information
 */
export class ContextCollector {
  /**
   * Collect current project context
   */
  async collectContext(): Promise<ProjectContext> {
    const context: ProjectContext = {};
    // Collect active file and selection
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const document = editor.document;

      // Collect active file
      const content = document.getText();
      context.activeFile = {
        path: this.getRelativePath(document.uri.fsPath),
        content: content,
        language: document.languageId,
      };

      // Collect selection
      const selection = editor.selection;
      if (!selection.isEmpty) {
        const selectedText = document.getText(selection);
        context.selection = {
          text: selectedText,
          startLine: selection.start.line + 1, // 1-indexed
          endLine: selection.end.line + 1,
        };
      }

      // Collect cursor position
      context.cursorPosition = {
        line: selection.active.line + 1, // 1-indexed
        character: selection.active.character + 1,
      };
    }

    // Collect diagnostics
    context.diagnostics = await this.collectDiagnostics();

    // Collect project file tree
    context.fileTree = await this.collectFileTree();

    // Collect AGENTS.md guidance if present
    context.agentInstructions = await this.collectAgentInstructions();

    return context;
  }

  /**
   * Format project context for prompt input
   */
  formatContext(context: ProjectContext): string {
    const blocks: string[] = [];

    if (context.activeFile) {
      const language = context.activeFile.language
        ? ` (${context.activeFile.language})`
        : "";
      blocks.push(
        `## Active File: ${context.activeFile.path}${language}\n${context.activeFile.content}`
      );
    }

    if (context.selection) {
      blocks.push(
        `## Selection (${context.selection.startLine}-${context.selection.endLine})\n${context.selection.text}`
      );
    }

    if (context.cursorPosition) {
      blocks.push(
        `## Cursor Position\nLine: ${context.cursorPosition.line}, Character: ${context.cursorPosition.character}`
      );
    }

    if (context.diagnostics && context.diagnostics.length > 0) {
      const diagLines = this.formatDiagnostics(context.diagnostics);
      blocks.push(
        `## Diagnostics (${context.diagnostics.length})\n${diagLines.join("\n")}`
      );
    }

    if (context.fileTree && context.fileTree.length > 0) {
      const treeContent = this.formatFileTree(context.fileTree, 0, 3);
      blocks.push(`## Workspace Structure\n${treeContent}`);
    }

    if (context.agentInstructions) {
      blocks.push(
        `## AGENTS.md (${context.agentInstructions.path})\n${context.agentInstructions.content}`
      );
    }

    return blocks.join("\n\n");
  }

  /**
   * Collect diagnostic information
   */
  async collectDiagnostics(): Promise<DiagnosticInfo[]> {
    const diagnostics: DiagnosticInfo[] = [];

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

    return diagnostics;
  }

  /**
   * Collect project file tree
   */
  async collectFileTree(): Promise<FileNode[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const rootFolder = workspaceFolders[0];
    const tree = await this.buildFileTree(rootFolder.uri, rootFolder.name);

    return tree ? [tree] : [];
  }

  /**
   * Collect AGENTS.md if it exists at the workspace root
   */
  private async collectAgentInstructions(): Promise<{
    path: string;
    content: string;
  } | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }

    const agentsUri = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      "AGENTS.md"
    );

    try {
      const contentBytes = await vscode.workspace.fs.readFile(agentsUri);
      const content = Buffer.from(contentBytes).toString("utf-8");
      if (!content.trim()) {
        return undefined;
      }
      return {
        path: this.getRelativePath(agentsUri.fsPath),
        content,
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Build file tree recursively
   */
  private async buildFileTree(
    uri: vscode.Uri,
    name: string
  ): Promise<FileNode | null> {
    const stat = await vscode.workspace.fs.stat(uri);

    if (stat.type === vscode.FileType.File) {
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
        const entryUri = vscode.Uri.joinPath(uri, entryName);
        const childNode = await this.buildFileTree(entryUri, entryName);

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


  private formatDiagnostics(diagnostics: DiagnosticInfo[]): string[] {
    return diagnostics.map(
      (diag) =>
        `[${diag.severity.toUpperCase()}] ${diag.file}:${diag.line}:${
          diag.column
        } - ${diag.message}`
    );
  }

}
