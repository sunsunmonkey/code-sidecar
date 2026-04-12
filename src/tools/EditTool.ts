import * as vscode from "vscode";
import { BaseTool, ParameterDefinition } from "./Tool";
import { resolveWorkspacePath } from "./pathValidation";

const normalizeLineEndings = (text: string): string =>
	text.replace(/\r\n/g, "\n");

const normalizeTrailingWhitespace = (text: string): string =>
	text
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");

const findFuzzyMatch = (
	content: string,
	search: string
): { index: number; matchedText: string; exact: boolean } | null => {
	const exactIndex = content.indexOf(search);
	if (exactIndex !== -1) {
		const secondOccurrence = content.indexOf(search, exactIndex + 1);
		if (secondOccurrence !== -1) {
			return null;
		}
		return { index: exactIndex, matchedText: search, exact: true };
	}

	const normalizedContent = normalizeTrailingWhitespace(content);
	const normalizedSearch = normalizeTrailingWhitespace(search);
	const normalizedIndex = normalizedContent.indexOf(normalizedSearch);
	if (normalizedIndex !== -1) {
		const contentLines = content.split("\n");
		const normalizedLines = normalizedContent.split("\n");
		const searchLineCount = normalizedSearch.split("\n").length;

		let normalizedLineIndex = 0;
		let charCount = 0;
		for (let i = 0; i < normalizedLines.length; i++) {
			if (charCount === normalizedIndex) {
				normalizedLineIndex = i;
				break;
			}
			charCount += normalizedLines[i].length + 1;
		}

		const originalLines = contentLines.slice(
			normalizedLineIndex,
			normalizedLineIndex + searchLineCount
		);
		const matchedText = originalLines.join("\n");
		return { index: content.indexOf(matchedText), matchedText, exact: false };
	}

	const trimmedSearch = search.trim();
	const trimmedIndex = content.indexOf(trimmedSearch);
	if (trimmedIndex !== -1) {
		const secondOccurrence = content.indexOf(trimmedSearch, trimmedIndex + 1);
		if (secondOccurrence === -1) {
			return { index: trimmedIndex, matchedText: trimmedSearch, exact: false };
		}
	}

	return null;
};

export class EditTool extends BaseTool {
	readonly name = "edit";
	readonly description =
		"Edit a file by searching for exact text and replacing it. The search text must match the file content exactly, including indentation.";
	readonly requiresPermission = true;

	readonly parameters: ParameterDefinition[] = [
		{
			name: "path",
			type: "string",
			required: true,
			description: "The path to the file to edit",
		},
		{
			name: "search",
			type: "string",
			required: true,
			description:
				"The exact text to find in the file, including whitespace and indentation",
		},
		{
			name: "replace",
			type: "string",
			required: true,
			description: "The replacement text",
		},
	];

	async execute(params: Record<string, unknown>): Promise<string> {
		const filePath = params.path as string;
		const rawSearch = params.search;
		const rawReplace = params.replace;

		if (typeof rawSearch !== "string" || rawSearch.length === 0) {
			throw new Error(
				`Invalid search parameter for file ${filePath}. The search text is empty or was not properly parsed — this often happens when the search content contains XML-like tags that interfere with parameter parsing. Re-read the file and retry with simpler, shorter search text that avoids angle brackets.`
			);
		}
		if (typeof rawReplace !== "string") {
			throw new Error(
				`Invalid replace parameter for file ${filePath}. The replace text was not properly parsed — this often happens when the content contains XML-like tags. Re-read the file and retry.`
			);
		}

		const searchText = normalizeLineEndings(rawSearch);
		const replaceText = normalizeLineEndings(rawReplace);

		try {
			const validatedPath = resolveWorkspacePath(filePath);
			const uri = vscode.Uri.file(validatedPath);
			const fileContent = await vscode.workspace.fs.readFile(uri);
			const content = normalizeLineEndings(
				Buffer.from(fileContent).toString("utf-8")
			);

			const match = findFuzzyMatch(content, searchText);

			if (!match) {
				const searchLines = searchText.split("\n");
				const firstLine = searchLines[0].trim();
				const lastLine = searchLines[searchLines.length - 1].trim();
				const contextHint = firstLine === lastLine
					? `The search text starts and ends with: "${firstLine.substring(0, 60)}"`
					: `The search text starts with: "${firstLine.substring(0, 60)}" and ends with: "${lastLine.substring(0, 60)}"`;

				throw new Error(
					`Search text not found in file ${filePath}.\n` +
					`${contextHint}\n` +
					`Tip: Re-read the file to get the exact current content, then retry with the correct search text.`
				);
			}

			const newContent = content.slice(0, match.index) +
				replaceText +
				content.slice(match.index + match.matchedText.length);

			const newContentBuffer = Buffer.from(newContent, "utf-8");
			await vscode.workspace.fs.writeFile(uri, newContentBuffer);

			const linesRemoved = match.matchedText.split("\n").length;
			const linesAdded = replaceText.split("\n").length;
			const linesDiff = linesAdded - linesRemoved;
			const diffSign = linesDiff > 0 ? "+" : "";
			const matchNote = match.exact ? "" : " (fuzzy match)";

			return (
				`Edited ${filePath}${matchNote}\n` +
				`${linesRemoved} removed, ${linesAdded} added (${diffSign}${linesDiff} net)`
			);
		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes("Access denied")) {
					throw error;
				}
				if (
					error.message.includes("Search text not found") ||
					error.message.includes("appears multiple times")
				) {
					throw error;
				}
				if (
					error.message.includes("ENOENT") ||
					error.message.includes("FileNotFound")
				) {
					throw new Error(`File not found: ${filePath}`);
				}
				if (
					error.message.includes("EACCES") ||
					error.message.includes("permission")
				) {
					throw new Error(`Permission denied: Cannot modify file ${filePath}`);
				}
			}

			throw new Error(
				`Failed to edit ${filePath}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}
}
