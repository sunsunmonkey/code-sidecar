import { exec } from "child_process";
import { promisify } from "util";
import { BaseTool, ParameterDefinition } from "./Tool";
import { resolveWorkspacePathOrRoot } from "./pathValidation";

/**
 * ExecuteCommandTool - executes shell commands in the extension host
 *
 * This tool runs shell commands directly and captures output without
 * opening a VS Code terminal. This tool requires user permission before execution.
 */
export class ExecuteCommandTool extends BaseTool {
  readonly name = "execute_command";
  readonly description =
    "Execute a shell command directly in the extension host and capture output. Use this to run build commands, tests, linters, or other CLI tools.";
  readonly requiresPermission = true;
  private static readonly execAsync = promisify(exec);

  readonly parameters: ParameterDefinition[] = [
    {
      name: "command",
      type: "string",
      required: true,
      description: "The shell command to execute",
    },
    {
      name: "cwd",
      type: "string",
      required: false,
      description:
        "The working directory for the command (relative to workspace root). Defaults to workspace root.",
    },
  ];

  /**
   * Execute command and capture output
   */
  private async executeCommand(
    command: string,
    cwd: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await ExecuteCommandTool.execAsync(command, {
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
      const stderr =
        typeof errorWithOutput.stderr === "string"
          ? errorWithOutput.stderr.trim()
          : typeof errorWithOutput.message === "string"
            ? errorWithOutput.message
            : "Command failed.";
      const exitCode =
        typeof errorWithOutput.code === "number" ? errorWithOutput.code : 1;

      return {
        stdout,
        stderr,
        exitCode,
      };
    }
  }

  /**
   * Execute the command directly without opening a terminal
   */
  async execute(params: Record<string, unknown>): Promise<string> {
    const command = params.command as string;
    const cwd = params.cwd as string | undefined;

    try {
      const validatedCwd = resolveWorkspacePathOrRoot(cwd, {
        fallbackToWorkspaceRoot: true,
      });
      const { stdout, stderr, exitCode } = await this.executeCommand(
        command,
        validatedCwd
      );

      let result = `Working directory: ${validatedCwd}\n`;
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
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("Working directory:")) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to execute command: ${message}`);
    }
  }
}
