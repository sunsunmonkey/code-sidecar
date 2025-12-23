# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the VS Code extension code (`extension.ts` entry), with core logic in `core/` (API handler, task runner), workflow helpers in `managers/`, tool adapters in `tools/`, and sidebar/webview glue in `ui/`.
- `webview-ui/` houses the React + Vite client; build outputs land in `webview-ui/dist/` and are bundled into the extension.
- `assets/` stores icons for the activity bar; build artifacts go to `dist/` via `esbuild.js`; root configs (`tsconfig.json`, `eslint.config.mjs`, `pnpm-workspace.yaml`) apply to the extension workspace.

## Build, Test, and Development Commands

- Install dependencies with `pnpm install`.
- `pnpm run compile` type-checks, lints, and builds the extension into `dist/`; `pnpm run package` does the same with production flags.
- `pnpm run watch` runs esbuild and TypeScript watch in parallel; use `pnpm run watch:esbuild` or `watch:tsc` when you only need one loop.
- `pnpm run lint` runs ESLint; `pnpm run check-types` runs strict TS checks.
- `pnpm test` drives the VS Code integration harness; regenerate test output with `pnpm run compile-tests` before running.

## Coding Style & Naming Conventions

- TypeScript is strict (`tsconfig.json`); keep source in `src/` and never edit `dist/` by hand.
- ESLint enforces curly braces, strict equality, semicolons, and import names in camelCase/PascalCase. Use camelCase for vars/functions, PascalCase for classes/components, and SCREAMING_SNAKE_CASE for constants.
- Match the existing formatting (tabs present in TS files); avoid large reformat-only diffs unless agreed upon.

## Testing Guidelines

- Use Mocha-style tests (types provided) co-located as `*.test.ts` near the code under test (e.g., `src/core/task.test.ts`).
- Cover new behaviors and permission flows; include success and failure assertions, especially around `core/task.ts` and API handlers.
- Run `pnpm run compile-tests` then `pnpm test` before PRs to ensure the VS Code runner passes.

## Commit & Pull Request Guidelines

- Follow the conventional commits observed here (`feat:`, `fix:`, `chore:`); keep messages imperative and scoped.
- PRs should describe scope, link issues, list manual test steps, and attach UI screenshots/GIFs when touching `webview-ui`.
- Update docs and changelogs when behavior or settings change; note any new configuration keys under `contributes.configuration`.

## Security & Configuration Tips

- Never hardcode API keys or endpoints; use the `codeSidecar.api.*` settings and keep secrets out of git.
- Review permission defaults (`codeSidecar.permissions.*`) before shipping and avoid committing generated artifacts (`dist/`, `node_modules/`).

# Base Rules

## Code & Architecture

- Keep the code concise and clean. Avoid over-defensive programming; do not add excessive safety checks or unnecessary try-catch blocks.
- **No backward compatibility** - Break old formats freely
- When there is duplicated logic or similar code blocks, consider extracting them into a shared module or separate file.
- If the content of a file is too large or contains multiple responsibilities, the code MUST be split into multiple smaller files, each with a clear, single responsibility and an explicitly stated filename.
- Prefer leveraging well-maintained libraries or external packages if they can simplify the implementation and improve code maintainability.

## Page Design Language

- The overall visual style should be clean, minimal, and elegant.
- Prioritize clarity and simplicity over decoration.
- Avoid borders or boxed layouts; use whitespace and alignment to define structure instead.
- Layouts should feel lightweight and unobtrusive, with a focus on content readability.
- Do not use a gradient background.

## Constraints

- Do not use any Python commands.
