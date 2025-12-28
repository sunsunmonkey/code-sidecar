export interface InitCommand {
  raw: string;
  guidance: string;
}

const INIT_PATTERN = /^\/init(?:\s+([\s\S]*))?$/i;

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

export const buildInitPrompt = (guidance: string): string => {
  const lines = [
    "You are running the /init workflow.",
    "Create or update AGENTS.md at the repository root with concise, repo-specific guidance for future coding tasks.",
    "",
    "Requirements:",
    "1) Inspect the repo layout with list_files.",
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
