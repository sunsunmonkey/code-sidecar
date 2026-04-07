import * as vscode from "vscode";
import * as path from "path";
import type {
  SkillReferenceItem,
  WorkspaceReferenceItem,
} from "code-sidecar-shared/types/messages";
import { getWorkspaceExcludePattern } from "./workspaceIgnore";
import { logger } from "code-sidecar-shared/utils/logger";

type WorkspaceIndex = {
  entries: WorkspaceReferenceItem[];
  timestamp: number;
};

type SkillIndex = {
  entries: SkillReferenceItem[];
  timestamp: number;
};

const SKILL_GLOBS = [
  "**/.agent/skills/**/SKILL.md",
  "**/.code-sidecar/skills/**/SKILL.md",
  "**/skills/**/SKILL.md",
];

export class WorkspaceSearchManager {
  private cache?: WorkspaceIndex;
  private skillCache?: SkillIndex;
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

  async searchSkills(query: string, limit = 20): Promise<SkillReferenceItem[]> {
    const entries = await this.getSkillEntries();
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return entries.slice(0, limit);
    }

    return entries
      .map((entry) => {
        const haystack = `${entry.name} ${entry.path} ${entry.description}`.toLowerCase();
        const index = haystack.indexOf(normalizedQuery);
        if (index < 0) {
          return null;
        }
        const exact = entry.name.toLowerCase() === normalizedQuery ? 1 : 0;
        const prefix = entry.name.toLowerCase().startsWith(normalizedQuery) ? 1 : 0;
        return { entry, exact, prefix, index };
      })
      .filter(
        (
          result
        ): result is {
          entry: SkillReferenceItem;
          exact: number;
          prefix: number;
          index: number;
        } => Boolean(result)
      )
      .sort((a, b) => {
        if (a.exact !== b.exact) {
          return b.exact - a.exact;
        }
        if (a.prefix !== b.prefix) {
          return b.prefix - a.prefix;
        }
        if (a.index !== b.index) {
          return a.index - b.index;
        }
        return a.entry.name.localeCompare(b.entry.name);
      })
      .slice(0, limit)
      .map((result) => result.entry);
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

  private async getSkillEntries(): Promise<SkillReferenceItem[]> {
    const now = Date.now();
    if (this.skillCache && now - this.skillCache.timestamp < this.cacheTtlMs) {
      return this.skillCache.entries;
    }

    const entries = await this.buildSkillIndex();
    this.skillCache = { entries, timestamp: now };
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

  private async buildSkillIndex(): Promise<SkillReferenceItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const exclude = getWorkspaceExcludePattern();

    let skillFiles: vscode.Uri[] = [];
    try {
      const nestedResults = await Promise.all(
        SKILL_GLOBS.map((glob) =>
          vscode.workspace.findFiles(glob, exclude, this.maxIndexEntries)
        )
      );
      skillFiles = nestedResults.flat();
    } catch (error) {
      logger.debug(
        "[WorkspaceSearchManager] Failed to index workspace skills",
        error
      );
      return [];
    }

    const deduped = new Map<string, SkillReferenceItem>();
    for (const uri of skillFiles) {
      const relativeSkillPath = path.relative(workspaceRoot, uri.fsPath);
      const skillDir = path.dirname(relativeSkillPath);
      const fallbackName = path.basename(skillDir);
      const parsed = await this.readSkillMeta(uri);
      const name = parsed.name || fallbackName;

      deduped.set(relativeSkillPath, {
        name,
        path: relativeSkillPath,
        description: parsed.description || `Skill in ${skillDir}`,
      });
    }

    return Array.from(deduped.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  private async readSkillMeta(
    uri: vscode.Uri
  ): Promise<{ name: string; description: string }> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = new TextDecoder().decode(bytes).replace(/\r\n/g, "\n");
      const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
      if (!match) {
        return { name: "", description: "" };
      }

      let name = "";
      let description = "";
      for (const line of match[1].split("\n")) {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) {
          continue;
        }
        const key = line.slice(0, separatorIndex).trim();
        const value = line
          .slice(separatorIndex + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        if (key === "name") {
          name = value;
        } else if (key === "description") {
          description = value;
        }
      }

      return { name, description };
    } catch {
      return { name: "", description: "" };
    }
  }
}
