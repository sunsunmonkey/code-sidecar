import * as path from "path";
import * as vscode from "vscode";

type WorkspacePathOptions = {
  fallbackToWorkspaceRoot?: boolean;
};

const getWorkspaceRoot = (): string => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error("No workspace folder is open");
  }

  return workspaceFolders[0].uri.fsPath;
};

const isWithinWorkspace = (workspaceRoot: string, resolvedPath: string): boolean => {
  const normalizedRoot = path.normalize(workspaceRoot);
  const normalizedPath = path.normalize(resolvedPath);
  const relative = path.relative(normalizedRoot, normalizedPath);

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export const resolveWorkspacePath = (inputPath: string): string => {
  const workspaceRoot = getWorkspaceRoot();
  const resolvedPath = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(workspaceRoot, inputPath);

  if (!isWithinWorkspace(workspaceRoot, resolvedPath)) {
    throw new Error(
      `Access denied: Path '${inputPath}' is outside the workspace`
    );
  }

  return path.normalize(resolvedPath);
};

export const resolveWorkspacePathOrRoot = (
  inputPath: string | undefined,
  options: WorkspacePathOptions = {}
): string => {
  if (!inputPath && options.fallbackToWorkspaceRoot) {
    return getWorkspaceRoot();
  }

  if (!inputPath) {
    throw new Error("Path is required");
  }

  return resolveWorkspacePath(inputPath);
};

export const tryResolveWorkspacePath = (
  inputPath: string
): string | null => {
  try {
    return resolveWorkspacePath(inputPath);
  } catch {
    return null;
  }
};
