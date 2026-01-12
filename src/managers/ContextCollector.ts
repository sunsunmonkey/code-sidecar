import * as vscode from "vscode";
import * as path from "path";
import { tryResolveWorkspacePath } from "../tools/pathValidation";
import { isIgnoredDirectory } from "./workspaceIgnore";

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
 * Referenced file content
 */
export interface ReferencedFile {
  path: string;
  content: string;
  language?: string;
}

/**
 * Reference resolution error
 */
export interface ReferenceError {
  path: string;
  error: string;
}

interface WorkspaceReferenceRequest {
  path?: string;
  depth: number;
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

  // Referenced files from @file
  referencedFiles?: ReferencedFile[];

  // Reference resolution errors
  referenceErrors?: ReferenceError[];

  // Override workspace structure depth (from @workspace)
  workspaceStructureDepth?: number;
}

/**
 * ContextCollector collects project context information
 */
export class ContextCollector {
  private readonly workspaceReferenceDepth = 5;

  /**
   * Collect current project context
   */
  async collectContext(message?: string): Promise<ProjectContext> {
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

    const referenceErrors: ReferenceError[] = [];

    if (message) {
      const fileReferences = this.extractFileReferences(message);
      if (fileReferences.length > 0) {
        const { files, errors } = await this.collectReferencedFiles(
          fileReferences
        );
        if (files.length > 0) {
          context.referencedFiles = files;
        }
        if (errors.length > 0) {
          referenceErrors.push(...errors);
        }
      }

      const workspaceReferences = this.extractWorkspaceReferences(message);
      if (workspaceReferences.length > 0) {
        const workspaceResult = await this.collectWorkspaceTrees(
          workspaceReferences
        );
        if (workspaceResult.trees.length > 0) {
          context.fileTree = workspaceResult.trees;
        }
        if (workspaceResult.maxDepth) {
          context.workspaceStructureDepth = workspaceResult.maxDepth;
        }
        if (workspaceResult.errors.length > 0) {
          referenceErrors.push(...workspaceResult.errors);
        }
      }
    }

    // Collect project file tree when no @workspace reference is present
    if (!context.fileTree) {
      context.fileTree = await this.collectFileTree();
    }

    if (referenceErrors.length > 0) {
      context.referenceErrors = referenceErrors;
    }

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

    if (context.referencedFiles && context.referencedFiles.length > 0) {
      const referencedBlocks = context.referencedFiles.map((file) => {
        const language = file.language ? ` (${file.language})` : "";
        return `### ${file.path}${language}\n${file.content}`;
      });
      blocks.push(`## Referenced Files\n${referencedBlocks.join("\n\n")}`);
    }

    if (context.referenceErrors && context.referenceErrors.length > 0) {
      const errorLines = context.referenceErrors.map(
        (error) => `- ${error.path}: ${error.error}`
      );
      blocks.push(`## Reference Errors\n${errorLines.join("\n")}`);
    }

    if (context.fileTree && context.fileTree.length > 0) {
      const maxDepth = context.workspaceStructureDepth ?? 3;
      if (maxDepth > 0) {
        const treeContent = this.formatFileTree(context.fileTree, 0, maxDepth);
        blocks.push(`## Workspace Structure\n${treeContent}`);
      }
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
      if (isIgnoredDirectory(name)) {
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

  private extractFileReferences(message: string): string[] {
    const references = new Set<string>();
    const pattern = /@file\s+(?:"([^"]+)"|'([^']+)'|(\S+))/g;
    for (const match of message.matchAll(pattern)) {
      const rawPath = match[1] ?? match[2] ?? match[3];
      if (!rawPath) {
        continue;
      }
      const cleanedPath = this.cleanReferencePath(rawPath);
      if (cleanedPath) {
        references.add(cleanedPath);
      }
    }
    return Array.from(references);
  }

  private extractWorkspaceReferences(message: string): WorkspaceReferenceRequest[] {
    const references: WorkspaceReferenceRequest[] = [];
    const pattern =
      /@workspace(?::(\d+)|\((\d+)\))?(?:\s+(?:"([^"]+)"|'([^']+)'|(\S+)))?/gi;

    for (const match of message.matchAll(pattern)) {
      const rawDepth = match[1] ?? match[2];
      const parsedDepth = rawDepth
        ? Number.parseInt(rawDepth, 10)
        : this.workspaceReferenceDepth;
      if (Number.isNaN(parsedDepth) || parsedDepth <= 0) {
        continue;
      }

      const rawPath = match[3] ?? match[4] ?? match[5];
      const cleanedPath = this.cleanReferencePath(rawPath);

      references.push({
        path: cleanedPath,
        depth: parsedDepth,
      });
    }

    return references;
  }

  private mergeWorkspaceReferences(
    references: WorkspaceReferenceRequest[]
  ): WorkspaceReferenceRequest[] {
    const merged = new Map<string, number>();

    for (const reference of references) {
      const key = reference.path ?? "";
      const existingDepth = merged.get(key) ?? 0;
      merged.set(key, Math.max(existingDepth, reference.depth));
    }

    return Array.from(merged.entries()).map(([path, depth]) => ({
      path: path || undefined,
      depth,
    }));
  }

  private async collectWorkspaceTrees(
    references: WorkspaceReferenceRequest[]
  ): Promise<{
    trees: FileNode[];
    errors: ReferenceError[];
    maxDepth?: number;
  }> {
    const trees: FileNode[] = [];
    const errors: ReferenceError[] = [];

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      errors.push({
        path: "@workspace",
        error: "No workspace folder is open.",
      });
      return { trees, errors };
    }

    const workspaceRoot = workspaceFolders[0].uri;
    const workspaceName = workspaceFolders[0].name;
    const mergedReferences = this.mergeWorkspaceReferences(references);
    let maxDepth = 0;

    for (const reference of mergedReferences) {
      maxDepth = Math.max(maxDepth, reference.depth);
      const referencePath = reference.path?.trim();

      let targetUri = workspaceRoot;
      let targetName = workspaceName;
      let displayPath = "@workspace";

      if (referencePath) {
        const resolvedPath = tryResolveWorkspacePath(referencePath);
        if (!resolvedPath) {
          errors.push({
            path: referencePath,
            error: "Path is outside the workspace or no workspace is open.",
          });
          continue;
        }
        targetUri = vscode.Uri.file(resolvedPath);
        targetName = path.basename(resolvedPath);
        displayPath = referencePath;
      }

      if (referencePath && isIgnoredDirectory(targetName)) {
        errors.push({
          path: displayPath,
          error: "Directory is ignored for workspace context.",
        });
        continue;
      }

      try {
        const stat = await vscode.workspace.fs.stat(targetUri);
        if (stat.type !== vscode.FileType.Directory) {
          errors.push({
            path: displayPath,
            error: "Path does not point to a directory.",
          });
          continue;
        }
        const tree = await this.buildFileTree(targetUri, targetName);
        if (tree) {
          trees.push(tree);
        } else {
          errors.push({
            path: displayPath,
            error: "No workspace entries found for this path.",
          });
        }
      } catch (error) {
        errors.push({
          path: displayPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      trees,
      errors,
      maxDepth: maxDepth > 0 ? maxDepth : undefined,
    };
  }

  private async collectReferencedFiles(
    filePaths: string[]
  ): Promise<{ files: ReferencedFile[]; errors: ReferenceError[] }> {
    const files: ReferencedFile[] = [];
    const errors: ReferenceError[] = [];

    for (const filePath of filePaths) {
      const resolvedPath = tryResolveWorkspacePath(filePath);
      if (!resolvedPath) {
        errors.push({
          path: filePath,
          error: "Path is outside the workspace or no workspace is open.",
        });
        continue;
      }

      const uri = vscode.Uri.file(resolvedPath);
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type !== vscode.FileType.File) {
          errors.push({
            path: filePath,
            error: "Path does not point to a file.",
          });
          continue;
        }

        const document = await vscode.workspace.openTextDocument(uri);
        files.push({
          path: this.getRelativePath(resolvedPath),
          content: document.getText(),
          language: document.languageId,
        });
      } catch (error) {
        errors.push({
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { files, errors };
  }

  private cleanReferencePath(rawPath?: string): string | undefined {
    if (!rawPath) {
      return undefined;
    }
    const cleanedPath = rawPath.trim().replace(/[),.;:\]]+$/g, "");
    return cleanedPath || undefined;
  }

}
