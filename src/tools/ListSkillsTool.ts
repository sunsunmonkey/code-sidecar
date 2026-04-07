import { BaseTool, ParameterDefinition } from "./Tool";
import { SkillManager } from "../managers/SkillManager";

export class ListSkillsTool extends BaseTool {
  readonly name = "list_skills";
  readonly description =
    "Discover Anthropic-compatible skills in the workspace. Skills are folders that contain a SKILL.md file with instructions and metadata.";
  readonly requiresPermission = false;

  readonly parameters: ParameterDefinition[] = [
    {
      name: "query",
      type: "string",
      required: false,
      description:
        "Optional query used to filter skills by name or description when looking for a relevant skill.",
    },
  ];

  constructor(private readonly skillManager: SkillManager) {
    super();
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const query = typeof params.query === "string" ? params.query.trim() : "";
    const skills = await this.skillManager.listSkills(query);

    if (skills.length === 0) {
      return query
        ? `No skills matched query: ${query}`
        : "No skills were discovered in the workspace.";
    }

    const header = query
      ? `Discovered skills matching "${query}":`
      : "Discovered workspace skills:";
    const lines = skills.map(
      (skill) =>
        `- ${skill.name}: ${skill.description} (directory: ${skill.directory})`
    );

    return `${header}\n${lines.join("\n")}`;
  }
}
