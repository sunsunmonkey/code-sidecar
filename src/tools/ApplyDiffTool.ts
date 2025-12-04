import * as vscode from "vscode";
import * as path from "path";
import { BaseTool, ParameterDefinition } from "./Tool";

/**
 * ApplyDiffTool - applies precise code edits using diff format
 * Requirements: 13.3
 *
 * This tool applies code changes using a diff-like format. It searches for
 * the exact "search" text in the file and replaces it with "replace" text.
 * This allows for precise, context-aware code editing.
 * This tool requires user permission before execution.
 */
export class ApplyDiffTool extends BaseTool {
  readonly name = "apply_diff";
  readonly description =
    "Apply precise code edits to a file by searching for exact text and replacing it. Use this for targeted code modifications.";
  readonly requiresPermission = true; // Modifying files requires permission

  readonly parameters: ParameterDefinition[] = [
    {
      name: "path",
      type: "string",
      required: true,
      description: "The relative or absolute path to the file to edit",
    },
    {
      name: "search",
      type: "string",
      required: true,
      description:
        "The exact text to search for in the file. Must match exactly including whitespace.",
    },
    {
      name: "replace",
      type: "string",
      required: true,
      description: "The text to replace the search text with",
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
      throw new Error("No workspace folder is open");
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
      throw new Error(
        `Access denied: Path '${filePath}' is outside the workspace`
      );
    }

    return normalizedPath;
  }

  /**
   * Execute the apply_diff tool
   * Requirements: 13.3
   */
  async execute(params: Record<string, any>): Promise<string> {
    const filePath = params.path as string;
    const searchText = params.search as string;
    const replaceText = params.replace as string;

    try {
      // Validate and normalize the path
      const validatedPath = this.validatePath(filePath);

      // Read the file
      const uri = vscode.Uri.file(validatedPath);
      const fileContent = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(fileContent).toString("utf-8");

      // Check if search text exists in the file
      const searchIndex = content.indexOf(searchText);
      if (searchIndex === -1) {
        throw new Error(
          `Search text not found in file ${filePath}.\n` +
            `Make sure the search text matches exactly, including whitespace and line endings.`
        );
      }

      // Check if search text appears multiple times
      const secondOccurrence = content.indexOf(searchText, searchIndex + 1);
      if (secondOccurrence !== -1) {
        throw new Error(
          `Search text appears multiple times in file ${filePath}.\n` +
            `Please provide more context in the search text to make it unique.`
        );
      }

      // Apply the replacement
      const newContent = content.replace(searchText, replaceText);

      // Write the modified content back
      const newContentBuffer = Buffer.from(newContent, "utf-8");
      await vscode.workspace.fs.writeFile(uri, newContentBuffer);

      // Calculate statistics for feedback
      const linesRemoved = searchText.split("\n").length;
      const linesAdded = replaceText.split("\n").length;
      const linesDiff = linesAdded - linesRemoved;
      const diffSign = linesDiff > 0 ? "+" : "";

      return (
        `Successfully applied diff to file: ${filePath}\n` +
        `Lines changed: ${linesRemoved} removed, ${linesAdded} added (${diffSign}${linesDiff} net)`
      );
    } catch (error) {
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes("Access denied")) {
          throw error; // Re-throw security errors
        }
        if (
          error.message.includes("Search text not found") ||
          error.message.includes("appears multiple times")
        ) {
          throw error; // Re-throw search-specific errors
        }
        if (
          error.message.includes("ENOENT") ||
          error.message.includes("FileNotFound")
        ) {
          throw new Error(`File not found: ${filePath}`);
        }
        if (
          error.message.includes("EACCES") ||
          error.message.includes("permission")
        ) {
          throw new Error(`Permission denied: Cannot modify file ${filePath}`);
        }
      }

      throw new Error(
        `Failed to apply diff to ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
