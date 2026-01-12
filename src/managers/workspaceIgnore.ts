const IGNORED_DIRECTORIES = [
  "node_modules",
  ".git",
  ".vscode",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  ".cache",
  ".temp",
  ".tmp",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  "venv",
  ".venv",
  "env",
  ".env",
];

export function isIgnoredDirectory(name: string): boolean {
  return IGNORED_DIRECTORIES.includes(name) || name.startsWith(".");
}

export function getWorkspaceExcludePattern(): string {
  return `**/{${IGNORED_DIRECTORIES.join(",")}}/**`;
}
