import { execFile } from "child_process";
import { promisify } from "util";
import { BaseTool, ParameterDefinition } from "./Tool";
import { resolveWorkspacePathOrRoot } from "./pathValidation";

type GitOperation =
  | "status"
  | "diff"
  | "log"
  | "branch"
  | "show"
  | "add"
  | "commit"
  | "checkout";

type GitOperationParams = {
  operation: GitOperation;
  target?: string;
  paths?: string[];
  staged?: boolean;
  maxCount?: number;
  all?: boolean;
  message?: string;
  create?: boolean;
};

const ALLOWED_OPERATIONS = new Set<GitOperation>([
  "status",
  "diff",
  "log",
  "branch",
  "show",
  "add",
  "commit",
  "checkout",
]);

const execFileAsync = promisify(execFile);

export class GitOperationsTool extends BaseTool {
  readonly name = "git_operations";
  readonly description =
    "Run common Git operations in the workspace (status, diff, log, branch, show, add, commit, checkout).";
  readonly requiresPermission = true;

  readonly parameters: ParameterDefinition[] = [
    {
      name: "operation",
      type: "string",
      required: true,
      description:
        "Git operation: status | diff | log | branch | show | add | commit | checkout.",
    },
    {
      name: "target",
      type: "string",
      required: false,
      description:
        "Target ref or branch for diff/show/checkout (optional for diff/show).",
    },
    {
      name: "paths",
      type: "array",
      required: false,
      description:
        "JSON array of file paths for diff/add (e.g., [\"src/index.ts\"]).",
    },
    {
      name: "message",
      type: "string",
      required: false,
      description: "Commit message (required for commit).",
    },
    {
      name: "staged",
      type: "boolean",
      required: false,
      description: "Use staged diff (diff only).",
    },
    {
      name: "maxCount",
      type: "number",
      required: false,
      description: "Maximum log entries (log only).",
    },
    {
      name: "all",
      type: "boolean",
      required: false,
      description: "Show all branches (branch only).",
    },
    {
      name: "create",
      type: "boolean",
      required: false,
      description: "Create new branch (checkout only).",
    },
    {
      name: "cwd",
      type: "string",
      required: false,
      description:
        "Working directory relative to workspace root (defaults to workspace root).",
    },
  ];

  private normalizeBoolean(value: unknown, name: string): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
    throw new Error(`Invalid ${name} flag.`);
  }

  private normalizeNumber(value: unknown, name: string): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    throw new Error(`Invalid ${name} value.`);
  }

  private normalizePaths(value: unknown): string[] | undefined {
    if (value === undefined) {
      return undefined;
    }

    let parsedValue: unknown = value;
    if (typeof value === "string") {
      parsedValue = JSON.parse(value);
    }

    if (!Array.isArray(parsedValue)) {
      throw new Error("Paths must be a JSON array.");
    }

    const paths = parsedValue.filter(
      (entry) => typeof entry === "string" && entry.trim()
    ) as string[];

    return paths.length > 0 ? paths.map((entry) => entry.trim()) : undefined;
  }

  private normalizeOperation(params: Record<string, unknown>): GitOperationParams {
    const operationValue = typeof params.operation === "string"
      ? params.operation.trim().toLowerCase()
      : "";

    if (!ALLOWED_OPERATIONS.has(operationValue as GitOperation)) {
      throw new Error(`Unsupported git operation: ${params.operation ?? ""}`);
    }

    const operation = operationValue as GitOperation;
    const target = typeof params.target === "string" ? params.target.trim() : undefined;
    const message = typeof params.message === "string" ? params.message.trim() : undefined;
    const staged = this.normalizeBoolean(params.staged, "staged");
    const all = this.normalizeBoolean(params.all, "all");
    const create = this.normalizeBoolean(params.create, "create");
    const maxCount = this.normalizeNumber(params.maxCount, "maxCount");
    const paths = this.normalizePaths(params.paths);

    return {
      operation,
      target,
      message,
      staged,
      all,
      create,
      maxCount,
      paths,
    };
  }

  override validate(params: Record<string, unknown>): boolean {
    if (!params || typeof params.operation !== "string") {
      return false;
    }

    try {
      const normalized = this.normalizeOperation(params);
      params.operation = normalized.operation;
      if (normalized.target !== undefined) {
        params.target = normalized.target;
      }
      if (normalized.message !== undefined) {
        params.message = normalized.message;
      }
      if (normalized.staged !== undefined) {
        params.staged = normalized.staged;
      }
      if (normalized.all !== undefined) {
        params.all = normalized.all;
      }
      if (normalized.create !== undefined) {
        params.create = normalized.create;
      }
      if (normalized.maxCount !== undefined) {
        params.maxCount = normalized.maxCount;
      }
      if (normalized.paths !== undefined) {
        params.paths = normalized.paths;
      }
    } catch {
      return false;
    }

    return super.validate(params);
  }

  private buildGitArgs(params: GitOperationParams): string[] {
    switch (params.operation) {
      case "status":
        return ["status", "--short", "--branch"];
      case "diff": {
        const args = ["diff"];
        if (params.staged) {
          args.push("--staged");
        }
        if (params.target) {
          args.push(params.target);
        }
        if (params.paths && params.paths.length > 0) {
          args.push("--", ...params.paths);
        }
        return args;
      }
      case "log": {
        const maxCount = params.maxCount && params.maxCount > 0 ? params.maxCount : 20;
        return ["log", "--oneline", `--max-count=${Math.floor(maxCount)}`];
      }
      case "branch": {
        const args = ["branch"];
        if (params.all) {
          args.push("--all");
        }
        return args;
      }
      case "show":
        return ["show", params.target || "HEAD"];
      case "add": {
        if (!params.paths || params.paths.length === 0) {
          throw new Error("Add operation requires at least one path.");
        }
        return ["add", "--", ...params.paths];
      }
      case "commit": {
        if (!params.message) {
          throw new Error("Commit operation requires a message.");
        }
        return ["commit", "-m", params.message];
      }
      case "checkout": {
        if (!params.target) {
          throw new Error("Checkout operation requires a target branch.");
        }
        const args = ["checkout"];
        if (params.create) {
          args.push("-b");
        }
        args.push(params.target);
        return args;
      }
      default:
        throw new Error(`Unsupported git operation: ${params.operation}`);
    }
  }

  private async runGitCommand(
    args: string[],
    cwd: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execFileAsync("git", args, {
        cwd,
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (error: unknown) {
      const errorWithOutput = error as {
        stdout?: unknown;
        stderr?: unknown;
        message?: unknown;
        code?: unknown;
      };
      const stdout =
        typeof errorWithOutput.stdout === "string"
          ? errorWithOutput.stdout.trim()
          : "";
      let stderr = "Command failed.";
      if (typeof errorWithOutput.stderr === "string") {
        stderr = errorWithOutput.stderr.trim();
      } else if (typeof errorWithOutput.message === "string") {
        stderr = errorWithOutput.message;
      }
      const exitCode =
        typeof errorWithOutput.code === "number" ? errorWithOutput.code : 1;

      return {
        stdout,
        stderr,
        exitCode,
      };
    }
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const normalized = this.normalizeOperation(params);
    const cwdParam = typeof params.cwd === "string" ? params.cwd : undefined;
    const cwd = resolveWorkspacePathOrRoot(cwdParam, {
      fallbackToWorkspaceRoot: true,
    });

    const args = this.buildGitArgs(normalized);
    const { stdout, stderr, exitCode } = await this.runGitCommand(args, cwd);

    let result = `Working directory: ${cwd}\n`;
    result += `Command: git ${args.join(" ")}\n`;
    result += `Exit code: ${exitCode}\n\n`;

    if (stdout) {
      result += `Stdout:\n${stdout}\n`;
    }

    if (stderr) {
      result += `${stdout ? "\n" : ""}Stderr:\n${stderr}\n`;
    }

    if (!stdout && !stderr) {
      result += "No output captured.";
    }

    if (exitCode !== 0) {
      throw new Error(result);
    }

    return result;
  }
}
