import * as vscode from "vscode";
import * as path from "path";
import { BaseTool, ParameterDefinition } from "./Tool";

/**
 * ReadFileTool - reads file content with line numbers
 * Requirements: 13.1
 *
 * This tool reads the content of a file and returns it with line numbers.
 * It includes security checks to prevent path traversal attacks.
 */
export class ReadFileTool extends BaseTool {
  readonly name = "read_file";
  readonly description =
    "Read the contents of a file. Returns the file content with line numbers for easy reference.";
  readonly requiresPermission = false; // Reading is generally safe

  readonly parameters: ParameterDefinition[] = [
    {
      name: "path",
      type: "string",
      required: true,
      description: "The relative or absolute path to the file to read",
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
   * Format file content with line numbers
   */
  private formatWithLineNumbers(content: string): string {
    const lines = content.split("\n");
    const maxLineNumberWidth = String(lines.length).length;

    return lines
      .map((line, index) => {
        const lineNumber = (index + 1)
          .toString()
          .padStart(maxLineNumberWidth, " ");
        return `${lineNumber} | ${line}`;
      })
      .join("\n");
  }

  /**
   * Execute the read_file tool
   * Requirements: 13.1, 13.4
   */
  async execute(params: Record<string, any>): Promise<string> {
    const filePath = params.path as string;

    try {
      // Validate and normalize the path
      const validatedPath = this.validatePath(filePath);

      // Read the file using VSCode API
      const uri = vscode.Uri.file(validatedPath);
      const fileContent = await vscode.workspace.fs.readFile(uri);

      // Convert buffer to string
      const content = Buffer.from(fileContent).toString("utf-8");

      // Format with line numbers
      const formattedContent = this.formatWithLineNumbers(content);

      // Return formatted result
      return `File: ${filePath}\n\n${formattedContent}`;
    } catch (error) {
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes("Access denied")) {
          throw error; // Re-throw security errors
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
          throw new Error(`Permission denied: Cannot read file ${filePath}`);
        }
      }

      throw new Error(
        `Failed to read file ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
