import * as vscode from "vscode";
import * as path from "path";


export type ContextKind =
  | "system_env"
  | "user_message"
  | "history"
  | "mention_file"
  | "mention_folder"
  | "mention_url"
  | "diagnostics"
  | "terminal"
  | "git_changes"
  | "git_commit"
  | "selection"
  | "open_tabs"
  | "code_search"
  | "workspace";

export type Truncation =
  | { mode: "none" }
  | { mode: "head"; maxLines: number }
  | { mode: "tail"; maxLines: number }
  | { mode: "head_tail"; head: number; tail: number }
  | { mode: "summarize"; summaryModelId?: string };

export interface ContextItem {
  id: string;
  kind: ContextKind;
  title: string;
  priority: number;
  content: string;
  tokenEstimate: number;
  truncation: Truncation;
  sourceMeta?: Record<string, any>;
  pinned?: boolean;
  appliedTruncation?: string;
}

export interface ContextSnapshotItem {
  id: string;
  title: string;
  kind: ContextKind;
  tokens: number;
  priority: number;
  pinned?: boolean;
  status: "included" | "truncated" | "dropped";
  note?: string;
}

export interface ContextSnapshot {
  totalTokens: number;
  budgetTokens: number;
  inputBudget: number;
  reservedOutputTokens: number;
  systemPromptTokens: number;
  userMessageTokens: number;
  items: ContextSnapshotItem[];
}

export interface BudgetedContext {
  selectedItems: ContextItem[];
  droppedItems: ContextItem[];
  formattedContext: string;
  totalTokens: number;
  budgetTokens: number;
  inputBudget: number;
  reservedOutputTokens: number;
  systemPromptTokens: number;
  userMessageTokens: number;
  snapshot: ContextSnapshot;
}

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
  private readonly MAX_FILE_SIZE = 50000; // Maximum single file size in characters
  private readonly MAX_FILES_IN_TREE = 500; // Maximum files to include in tree
  private readonly HEAD_TAIL_DEFAULT = { head: 120, tail: 80 };
  private readonly FAST_TOKEN_RATIO = 4; // Roughly 4 chars per token fallback

  /**
   * Collect current project context
   */
  async collectContext(): Promise<ProjectContext> {
    const context: ProjectContext = {};

    try {
      // Collect active file and selection
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
    } catch (error) {
      console.error("[ContextCollector] Error collecting context:", error);
    }

    return context;
  }

  /**
   * Collect context for a specific file
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
   * Fast token estimation (char/4 fallback)
   */
  estimateTokens(text: string): number {
    if (!text) {
      return 0;
    }
    return Math.ceil(text.length / this.FAST_TOKEN_RATIO) + 4;
  }

  /**
   * Build ContextItems from current project state plus parsed mentions
   */
  async collectContextItems(
    userMessage: string,
    existingContext?: ProjectContext
  ): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const projectContext = existingContext ?? (await this.collectContext());

    // System env
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspacePath =
      workspaceFolders && workspaceFolders.length > 0
        ? workspaceFolders[0].uri.fsPath
        : "No workspace open";
    const envContent = [
      `OS: ${process.platform} (${process.arch})`,
      `VS Code: ${vscode.version}`,
      `Workspace: ${workspacePath}`,
      `Shell: ${process.env.SHELL || process.env.COMSPEC || "unknown"}`,
    ].join("\n");
    items.push({
      id: "system-env",
      kind: "system_env",
      title: "System Environment",
      priority: 5,
      content: envContent,
      tokenEstimate: this.estimateTokens(envContent),
      truncation: { mode: "none" },
    });

    // Active file
    if (projectContext.activeFile) {
      const activeContent = projectContext.activeFile.content;
      const activeItem: ContextItem = {
        id: `file-${projectContext.activeFile.path}`,
        kind: "mention_file",
        title: `Current File: ${projectContext.activeFile.path}`,
        priority: 90,
        content: activeContent,
        tokenEstimate: this.estimateTokens(activeContent),
        truncation: {
          mode: "head_tail",
          head: this.HEAD_TAIL_DEFAULT.head,
          tail: this.HEAD_TAIL_DEFAULT.tail,
        },
        sourceMeta: {
          path: projectContext.activeFile.path,
          language: projectContext.activeFile.language,
        },
      };
      items.push(activeItem);
    }

    // Selection
    if (projectContext.selection) {
      const selContent = projectContext.selection.text;
      items.push({
        id: `selection-${Date.now()}`,
        kind: "selection",
        title: `Selection (${projectContext.selection.startLine}-${projectContext.selection.endLine})`,
        priority: 95,
        content: selContent,
        tokenEstimate: this.estimateTokens(selContent),
        truncation: { mode: "none" },
        sourceMeta: {
          startLine: projectContext.selection.startLine,
          endLine: projectContext.selection.endLine,
        },
      });
    } else if (vscode.window.activeTextEditor) {
      const editor = vscode.window.activeTextEditor;
      const cursor = editor.selection.active;
      const startLine = Math.max(cursor.line - 8, 0);
      const endLine = Math.min(cursor.line + 8, editor.document.lineCount - 1);
      const endChar = editor.document.lineAt(endLine).range.end.character;
      const range = new vscode.Range(startLine, 0, endLine, endChar);
      const nearby = editor.document.getText(range);
      items.push({
        id: `cursor-${Date.now()}`,
        kind: "selection",
        title: `Cursor window (${startLine + 1}-${endLine + 1})`,
        priority: 85,
        content: nearby,
        tokenEstimate: this.estimateTokens(nearby),
        truncation: { mode: "none" },
        sourceMeta: {
          startLine: startLine + 1,
          endLine: endLine + 1,
        },
      });
    }

    // Diagnostics
    if (projectContext.diagnostics && projectContext.diagnostics.length > 0) {
      const diagLines = this.formatDiagnostics(projectContext.diagnostics);
      const diagContent = diagLines.join("\n");
      items.push({
        id: "diagnostics",
        kind: "diagnostics",
        title: "Diagnostics (Problems)",
        priority: 70,
        content: diagContent,
        tokenEstimate: this.estimateTokens(diagContent),
        truncation: { mode: "tail", maxLines: 50 },
        sourceMeta: { count: projectContext.diagnostics.length },
      });
    }

    // Open tabs (metadata only)
    const openEditors = vscode.window.visibleTextEditors;
    if (openEditors.length > 0) {
      const openContent = openEditors
        .map((ed) => this.getRelativePath(ed.document.fileName))
        .join("\n");
      items.push({
        id: "open-tabs",
        kind: "open_tabs",
        title: "Open Tabs",
        priority: 40,
        content: openContent,
        tokenEstimate: this.estimateTokens(openContent),
        truncation: { mode: "head", maxLines: 40 },
      });
    }

    // Workspace tree snapshot (low priority)
    if (projectContext.fileTree && projectContext.fileTree.length > 0) {
      const treeContent = this.formatFileTree(projectContext.fileTree, 0, 3);
      items.push({
        id: "workspace-tree",
        kind: "workspace",
        title: "Workspace Structure",
        priority: 20,
        content: treeContent,
        tokenEstimate: this.estimateTokens(treeContent),
        truncation: { mode: "head", maxLines: 120 },
      });
    }

    // Mentions parsed from user message
    const mentionItems = await this.parseMentions(userMessage);
    items.push(...mentionItems);

    return items;
  }

  /**
   * Parse @mentions in the user message to enrich context
   */
  private async parseMentions(userMessage: string): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const fileRegex = /@file:([^\s]+)/g;
    const folderRegex = /@folder:([^\s]+)/g;
    const problemsMentioned = /@problems|@diagnostics/.test(userMessage);
    const terminalMentioned = /@terminal/.test(userMessage);

    let match: RegExpExecArray | null;

    while ((match = fileRegex.exec(userMessage)) !== null) {
      const filePath = match[1];
      const content = await this.collectFileContext(filePath);
      items.push({
        id: `mention-file-${filePath}-${match.index}`,
        kind: "mention_file",
        title: `@file ${filePath}`,
        priority: 85,
        content,
        tokenEstimate: this.estimateTokens(content),
        truncation: {
          mode: "head_tail",
          head: this.HEAD_TAIL_DEFAULT.head,
          tail: this.HEAD_TAIL_DEFAULT.tail,
        },
        sourceMeta: { path: filePath },
      });
    }

    while ((match = folderRegex.exec(userMessage)) !== null) {
      const folderPath = match[1];
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        continue;
      }
      const absolutePath = path.isAbsolute(folderPath)
        ? folderPath
        : path.join(workspaceFolders[0].uri.fsPath, folderPath);
      const tree = await this.collectFileTree();
      const treeText =
        tree.length > 0 ? this.formatFileTree(tree, 0, 2) : "[No files found]";
      items.push({
        id: `mention-folder-${folderPath}-${match.index}`,
        kind: "mention_folder",
        title: `@folder ${folderPath}`,
        priority: 60,
        content: treeText,
        tokenEstimate: this.estimateTokens(treeText),
        truncation: { mode: "head", maxLines: 200 },
        sourceMeta: { path: absolutePath },
      });
    }

    if (problemsMentioned) {
      const diagnostics = await this.collectDiagnostics();
      const diagLines = this.formatDiagnostics(diagnostics);
      const diagContent = diagLines.join("\n");
      items.push({
        id: "mention-diagnostics",
        kind: "diagnostics",
        title: "@problems",
        priority: 75,
        content: diagContent,
        tokenEstimate: this.estimateTokens(diagContent),
        truncation: { mode: "tail", maxLines: 50 },
        sourceMeta: { count: diagnostics.length },
        pinned: true,
      });
    }

    if (terminalMentioned) {
      const placeholder =
        "[Terminal context unavailable: VS Code API exposes only the visible buffer. Please re-run the command to capture output.]";
      items.push({
        id: "mention-terminal",
        kind: "terminal",
        title: "@terminal",
        priority: 65,
        content: placeholder,
        tokenEstimate: this.estimateTokens(placeholder),
        truncation: { mode: "none" },
        sourceMeta: { limited: true },
      });
    }

    return items;
  }

  private formatDiagnostics(diagnostics: DiagnosticInfo[]): string[] {
    return diagnostics.map(
      (diag) =>
        `[${diag.severity.toUpperCase()}] ${diag.file}:${diag.line}:${diag.column} - ${diag.message}`
    );
  }

  /**
   * Budget context items using a greedy strategy with truncation/drop fallback
   */
  budgetContextItems(params: {
    items: ContextItem[];
    userMessage: string;
    systemPrompt: string;
    contextWindowTokens: number;
    reservedOutputTokens?: number;
  }): BudgetedContext {
    const reservedOutputTokens =
      params.reservedOutputTokens ??
      Math.floor(params.contextWindowTokens * 0.2);
    const budgetTokens = Math.max(
      params.contextWindowTokens - reservedOutputTokens,
      0
    );
    const systemPromptTokens = this.estimateTokens(params.systemPrompt);
    const userMessageTokens = this.estimateTokens(params.userMessage);
    const selected: ContextItem[] = [];
    const dropped: ContextItem[] = [];

    let usedTokens = systemPromptTokens + userMessageTokens;

    const sortedItems = [...params.items].sort((a, b) => {
      const pinnedDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pinnedDelta !== 0) {
        return pinnedDelta;
      }
      if (b.priority === a.priority) {
        return b.tokenEstimate - a.tokenEstimate;
      }
      return b.priority - a.priority;
    });

    for (const item of sortedItems) {
      const remaining = budgetTokens - usedTokens;
      if (remaining <= 0) {
        dropped.push({ ...item, appliedTruncation: "dropped" });
        continue;
      }

      let workingItem: ContextItem = { ...item };

      if (workingItem.tokenEstimate > remaining) {
        const truncated = this.truncateContent(
          workingItem.content,
          workingItem.truncation
        );
        workingItem = {
          ...workingItem,
          content: truncated.content,
          tokenEstimate: this.estimateTokens(truncated.content),
          appliedTruncation: truncated.note,
        };
      }

      if (workingItem.tokenEstimate <= remaining || workingItem.pinned) {
        selected.push(workingItem);
        usedTokens += workingItem.tokenEstimate;
      } else {
        dropped.push({ ...workingItem, appliedTruncation: "dropped" });
      }
    }

    const formattedContext = selected
      .map((item) => {
        const header = `### ${item.title} [${item.kind}]${
          item.appliedTruncation ? ` (${item.appliedTruncation})` : ""
        }`;
        return `${header}\n${item.content}`;
      })
      .join("\n\n");

    const snapshotItems: ContextSnapshotItem[] = [
      ...selected.map(
        (item): ContextSnapshotItem => ({
          id: item.id,
          title: item.title,
          kind: item.kind,
          tokens: item.tokenEstimate,
          priority: item.priority,
          pinned: item.pinned,
          status: item.appliedTruncation ? "truncated" : "included",
          note: item.appliedTruncation,
        })
      ),
      ...dropped.map(
        (item): ContextSnapshotItem => ({
          id: item.id,
          title: item.title,
          kind: item.kind,
          tokens: item.tokenEstimate,
          priority: item.priority,
          pinned: item.pinned,
          status: "dropped",
          note: item.appliedTruncation,
        })
      ),
    ];

    return {
      selectedItems: selected,
      droppedItems: dropped,
      formattedContext,
      totalTokens: usedTokens,
      budgetTokens,
      inputBudget: budgetTokens,
      reservedOutputTokens,
      systemPromptTokens,
      userMessageTokens,
      snapshot: {
        totalTokens: usedTokens,
        budgetTokens,
        inputBudget: budgetTokens,
        reservedOutputTokens,
        systemPromptTokens,
        userMessageTokens,
        items: snapshotItems,
      },
    };
  }

  /**
   * Apply truncation policy to content
   */
  private truncateContent(
    content: string,
    truncation: Truncation
  ): { content: string; note?: string } {
    if (truncation.mode === "none") {
      return { content };
    }

    const lines = content.split("\n");
    if (truncation.mode === "tail") {
      const tailLines = lines.slice(-truncation.maxLines);
      return {
        content: tailLines.join("\n"),
        note: `tail (${tailLines.length} lines)`,
      };
    }

    if (truncation.mode === "head") {
      const headLines = lines.slice(0, truncation.maxLines);
      return {
        content: headLines.join("\n"),
        note: `head (${headLines.length} lines)`,
      };
    }

    if (truncation.mode === "head_tail") {
      const headLines = lines.slice(0, truncation.head);
      const tailLines = lines.slice(-truncation.tail);
      return {
        content: `${headLines.join("\n")}\n...\n${tailLines.join("\n")}`,
        note: `head_tail (${headLines.length}+${tailLines.length} lines)`,
      };
    }

    if (truncation.mode === "summarize") {
      const headLines = lines.slice(0, this.HEAD_TAIL_DEFAULT.head);
      const tailLines = lines.slice(-this.HEAD_TAIL_DEFAULT.tail);
      return {
        content: `${headLines.join("\n")}\n...\n${tailLines.join("\n")}`,
        note: "summarized (head+tail fallback)",
      };
    }

    return { content };
  }
}
