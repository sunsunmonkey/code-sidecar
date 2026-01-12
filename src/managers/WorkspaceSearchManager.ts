import * as vscode from "vscode";
import * as path from "path";
import type {
  WorkspaceReferenceItem,
} from "code-sidecar-shared/types/messages";
import { getWorkspaceExcludePattern } from "./workspaceIgnore";
import { logger } from "code-sidecar-shared/utils/logger";

type WorkspaceIndex = {
  entries: WorkspaceReferenceItem[];
  timestamp: number;
};

export class WorkspaceSearchManager {
  private cache?: WorkspaceIndex;
  private readonly cacheTtlMs = 60_000;
  private readonly maxIndexEntries = 20000;

  async search(
    query: string,
    limit = 50
  ): Promise<WorkspaceReferenceItem[]> {
    const entries = await this.getEntries();
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return entries.slice(0, limit);
    }

    const matches = entries
      .map((entry) => {
        const lowerPath = entry.path.toLowerCase();
        const index = lowerPath.indexOf(normalizedQuery);
        if (index < 0) {
          return null;
        }
        return { entry, index };
      })
      .filter((result): result is { entry: WorkspaceReferenceItem; index: number } =>
        Boolean(result)
      )
      .sort((a, b) => {
        if (a.index !== b.index) {
          return a.index - b.index;
        }
        if (a.entry.path.length !== b.entry.path.length) {
          return a.entry.path.length - b.entry.path.length;
        }
        return a.entry.path.localeCompare(b.entry.path);
      })
      .slice(0, limit)
      .map((result) => result.entry);

    return matches;
  }

  private async getEntries(): Promise<WorkspaceReferenceItem[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.timestamp < this.cacheTtlMs) {
      return this.cache.entries;
    }

    const entries = await this.buildIndex();
    this.cache = { entries, timestamp: now };
    return entries;
  }

  private async buildIndex(): Promise<WorkspaceReferenceItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const exclude = getWorkspaceExcludePattern();

    let files: vscode.Uri[] = [];
    try {
      files = await vscode.workspace.findFiles("**/*", exclude, this.maxIndexEntries);
    } catch (error) {
      logger.debug("[WorkspaceSearchManager] Failed to index workspace files", error);
      return [];
    }

    const fileEntries: WorkspaceReferenceItem[] = [];
    const directorySet = new Set<string>();

    for (const uri of files) {
      const relativePath = path.relative(workspaceRoot, uri.fsPath);
      if (!relativePath) {
        continue;
      }
      fileEntries.push({
        type: "file",
        path: relativePath,
        label: relativePath,
      });

      let dir = path.dirname(relativePath);
      while (dir && dir !== ".") {
        directorySet.add(dir);
        const parent = path.dirname(dir);
        if (parent === dir) {
          break;
        }
        dir = parent;
      }
    }

    const directoryEntries: WorkspaceReferenceItem[] = Array.from(
      directorySet
    )
      .sort((a, b) => a.localeCompare(b))
      .map((dir) => ({
        type: "directory",
        path: dir,
        label: `${dir}/`,
      }));

    const entries = [...directoryEntries, ...fileEntries].sort((a, b) =>
      a.path.localeCompare(b.path)
    );

    return entries;
  }
}
