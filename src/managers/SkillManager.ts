import * as path from "path";
import * as vscode from "vscode";

type SkillFrontmatter = {
  name?: string;
  description?: string;
};

export type SkillSummary = {
  name: string;
  description: string;
  directory: string;
  skillFile: string;
};

export type SkillResource = {
  path: string;
  content: string;
  truncated: boolean;
};

export type LoadedSkill = SkillSummary & {
  instructions: string;
  resources: SkillResource[];
};

const SKILL_FILE_NAME = "SKILL.md";
const SKILL_SEARCH_PATTERNS = [
  "**/.code-sidecar/skills/**/SKILL.md",
  "**/.agent/skills/**/SKILL.md",
  "**/skills/**/SKILL.md",
];
const SKILL_SEARCH_EXCLUDES =
  "**/{node_modules,dist,webview-ui/dist,.git,out,coverage}/**";
const RESOURCE_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
]);
const MAX_RESOURCE_BYTES = 16 * 1024;
const MAX_RESOURCE_COUNT = 3;
const textDecoder = new TextDecoder("utf-8");

export class SkillManager {
  private async getWorkspaceSkillFiles(): Promise<vscode.Uri[]> {
    const files = await Promise.all(
      SKILL_SEARCH_PATTERNS.map((pattern) =>
        vscode.workspace.findFiles(pattern, SKILL_SEARCH_EXCLUDES)
      )
    );

    const deduped = new Map<string, vscode.Uri>();
    for (const uriList of files) {
      for (const uri of uriList) {
        deduped.set(uri.fsPath, uri);
      }
    }

    return Array.from(deduped.values()).sort((a, b) =>
      a.fsPath.localeCompare(b.fsPath)
    );
  }

  async listSkills(query?: string): Promise<SkillSummary[]> {
    const skillFiles = await this.getWorkspaceSkillFiles();
    const skills = await Promise.all(
      skillFiles.map(async (skillFile) => this.readSkillSummary(skillFile))
    );
    const validSkills = skills.filter(
      (skill): skill is SkillSummary => skill !== null
    );

    if (!query?.trim()) {
      return validSkills;
    }

    return this.filterSkills(validSkills, query);
  }

  async loadSkill(skillName: string): Promise<LoadedSkill> {
    const skills = await this.listSkills();
    const matchedSkill = this.matchSkill(skills, skillName);

    if (!matchedSkill) {
      const availableNames = skills.map((skill) => skill.name).join(", ");
      throw new Error(
        availableNames
          ? `Skill '${skillName}' not found. Available skills: ${availableNames}`
          : `Skill '${skillName}' not found. No skills were discovered in the workspace.`
      );
    }

    const rawSkillFile = await this.readTextFile(matchedSkill.skillFile);
    const parsed = this.parseSkillDocument(rawSkillFile);
    const resources = await this.readSkillResources(matchedSkill.directory);

    return {
      ...matchedSkill,
      instructions: parsed.instructions,
      resources,
    };
  }

  private async readSkillSummary(
    skillFile: vscode.Uri
  ): Promise<SkillSummary | null> {
    try {
      const rawContent = await this.readTextFile(skillFile.fsPath);
      const parsed = this.parseSkillDocument(rawContent);
      const directory = path.dirname(skillFile.fsPath);
      const fallbackName = path.basename(directory);
      const name = parsed.frontmatter.name?.trim() || fallbackName;
      const description =
        parsed.frontmatter.description?.trim() ||
        this.getDescriptionFallback(parsed.instructions);

      return {
        name,
        description,
        directory,
        skillFile: skillFile.fsPath,
      };
    } catch {
      return null;
    }
  }

  private parseSkillDocument(content: string): {
    frontmatter: SkillFrontmatter;
    instructions: string;
  } {
    const normalizedContent = content.replace(/\r\n/g, "\n");

    if (!normalizedContent.startsWith("---\n")) {
      return {
        frontmatter: {},
        instructions: normalizedContent.trim(),
      };
    }

    const closingIndex = normalizedContent.indexOf("\n---\n", 4);
    if (closingIndex === -1) {
      return {
        frontmatter: {},
        instructions: normalizedContent.trim(),
      };
    }

    const frontmatterBlock = normalizedContent.slice(4, closingIndex);
    const instructions = normalizedContent
      .slice(closingIndex + "\n---\n".length)
      .trim();

    return {
      frontmatter: this.parseFrontmatter(frontmatterBlock),
      instructions,
    };
  }

  private parseFrontmatter(frontmatterBlock: string): SkillFrontmatter {
    const result: SkillFrontmatter = {};

    for (const line of frontmatterBlock.split("\n")) {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      if (key === "name") {
        result.name = value;
      } else if (key === "description") {
        result.description = value;
      }
    }

    return result;
  }

  private getDescriptionFallback(instructions: string): string {
    const firstMeaningfulLine = instructions
      .split("\n")
      .map((line) => line.trim())
      .find((line) => !!line && !line.startsWith("#"));

    return firstMeaningfulLine || "No description provided.";
  }

  private filterSkills(skills: SkillSummary[], query: string): SkillSummary[] {
    const queryTokens = this.tokenize(query);
    const scored = skills
      .map((skill) => ({
        skill,
        score: this.getSkillScore(skill, query, queryTokens),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));

    return scored.map((item) => item.skill);
  }

  private matchSkill(
    skills: SkillSummary[],
    skillName: string
  ): SkillSummary | undefined {
    const normalizedTarget = skillName.trim().toLowerCase();

    return (
      skills.find((skill) => skill.name.toLowerCase() === normalizedTarget) ||
      skills.find(
        (skill) => path.basename(skill.directory).toLowerCase() === normalizedTarget
      ) ||
      skills.find(
        (skill) =>
          skill.name.toLowerCase().includes(normalizedTarget) ||
          path.basename(skill.directory).toLowerCase().includes(normalizedTarget)
      )
    );
  }

  private tokenize(value: string): string[] {
    return value
      .toLowerCase()
      .split(/[^a-z0-9_-]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length > 1);
  }

  private getSkillScore(
    skill: SkillSummary,
    query: string,
    queryTokens: string[]
  ): number {
    const normalizedQuery = query.trim().toLowerCase();
    const haystack = `${skill.name} ${path.basename(skill.directory)} ${skill.description}`.toLowerCase();
    let score = 0;

    if (skill.name.toLowerCase() === normalizedQuery) {
      score += 100;
    }

    if (haystack.includes(normalizedQuery)) {
      score += 30;
    }

    for (const token of queryTokens) {
      if (skill.name.toLowerCase().includes(token)) {
        score += 15;
      }
      if (skill.description.toLowerCase().includes(token)) {
        score += 5;
      }
      if (path.basename(skill.directory).toLowerCase().includes(token)) {
        score += 10;
      }
    }

    return score;
  }

  private async readSkillResources(directoryPath: string): Promise<SkillResource[]> {
    const entries: [string, vscode.FileType][] = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(directoryPath)
    );
    const resourceFiles: [string, vscode.FileType][] = entries
      .filter(([name, type]: [string, vscode.FileType]) => {
        if (type !== vscode.FileType.File || name === SKILL_FILE_NAME) {
          return false;
        }
        return RESOURCE_EXTENSIONS.has(path.extname(name).toLowerCase());
      })
      .sort(
        (a: [string, vscode.FileType], b: [string, vscode.FileType]) =>
          a[0].localeCompare(b[0])
      )
      .slice(0, MAX_RESOURCE_COUNT);

    return Promise.all(
      resourceFiles.map(async ([fileName]: [string, vscode.FileType]) => {
        const resourcePath = path.join(directoryPath, fileName);
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(resourcePath));
        const truncated = bytes.byteLength > MAX_RESOURCE_BYTES;
        const content = textDecoder.decode(
          truncated ? bytes.slice(0, MAX_RESOURCE_BYTES) : bytes
        );

        return {
          path: resourcePath,
          content,
          truncated,
        };
      })
    );
  }

  private async readTextFile(filePath: string): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    return textDecoder.decode(bytes);
  }
}
