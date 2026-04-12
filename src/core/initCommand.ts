export interface InitCommand {
  raw: string;
  guidance: string;
}

export interface SlashSkillCommand {
  raw: string;
  skillName: string;
  guidance: string;
}

export type SlashCommand =
  | { kind: "init"; command: InitCommand }
  | { kind: "skill"; command: SlashSkillCommand };

const INIT_PATTERN = /^\/init(?:\s+([\s\S]*))?$/i;
const SLASH_SKILL_PATTERN = /^\/([a-z0-9][a-z0-9_-]*)(?:\s+([\s\S]*))?$/i;

export const parseInitCommand = (input: string): InitCommand | null => {
  const trimmed = input.trim();
  const match = trimmed.match(INIT_PATTERN);
  if (!match) {
    return null;
  }

  const guidance = (match[1] ?? "").trim();

  return {
    raw: input,
    guidance,
  };
};

export const parseSlashSkillCommand = (
  input: string
): SlashSkillCommand | null => {
  const trimmed = input.trim();
  const match = trimmed.match(SLASH_SKILL_PATTERN);
  if (!match) {
    return null;
  }

  const skillName = (match[1] ?? "").trim();
  if (!skillName || skillName.toLowerCase() === "init") {
    return null;
  }

  const guidance = (match[2] ?? "").trim();

  return {
    raw: input,
    skillName,
    guidance,
  };
};

export const parseSlashCommand = (input: string): SlashCommand | null => {
  const initCommand = parseInitCommand(input);
  if (initCommand) {
    return {
      kind: "init",
      command: initCommand,
    };
  }

  const skillCommand = parseSlashSkillCommand(input);
  if (skillCommand) {
    return {
      kind: "skill",
      command: skillCommand,
    };
  }

  return null;
};

export const buildInitPrompt = (guidance: string): string => {
  const lines = [
    "You are running the /init workflow.",
    "Create or update AGENTS.md at the repository root with concise, repo-specific guidance for future coding tasks.",
    "",
    "Requirements:",
    "1) Inspect the repo layout with execute_command (e.g., find or ls).",
    "2) Read only key top-level docs/configs as needed (README*, CONTRIBUTING*, package.json, tsconfig.json, eslint config, etc.).",
    "3) If AGENTS.md exists, preserve useful rules and merge new guidance; do not delete useful details.",
    "4) Write AGENTS.md with clear sections (Project Structure, Build/Test Commands, Coding Style, Testing, Commit/PR, Security/Configuration).",
    "5) Keep it short and actionable; use Markdown bullets; avoid speculation.",
    "6) Do not edit any other files.",
    "7) When finished, call attempt_completion with a brief summary of changes.",
  ];

  if (guidance) {
    lines.push("", "User notes:", guidance);
  }

  return lines.join("\n");
};

export const buildSlashSkillPrompt = (
  skillName: string,
  guidance: string
): string => {
  const lines = [
    `You are running the /${skillName} skill workflow.`,
    "Treat the slash command name as a strong hint that a matching workspace skill should be used.",
    "",
    "Requirements:",
    "1) Use normal file tools to inspect possible skill folders such as `.agent/skills`, `.code-sidecar/skills`, and `skills`.",
    `2) Look for a matching skill directory or a \`SKILL.md\` file related to "${skillName}".`,
    "3) Read the matching `SKILL.md` with normal file tools and follow its instructions for the current task.",
    "4) Read additional resource files in that skill folder only when needed.",
    "5) If no matching skill exists, explain that clearly and continue with the user's request using normal tools.",
    "6) Keep the slash command intent in mind throughout the task.",
    "7) When the task is complete, call attempt_completion.",
  ];

  if (guidance) {
    lines.push("", "User notes:", guidance);
  }

  return lines.join("\n");
};
