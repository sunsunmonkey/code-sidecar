import { BaseTool, ParameterDefinition } from "./Tool";
import { SkillManager } from "../managers/SkillManager";

export class LoadSkillTool extends BaseTool {
  readonly name = "load_skill";
  readonly description =
    "Load a specific Anthropic-compatible workspace skill by name. Returns the skill instructions and small companion resources so they can be followed in subsequent steps.";
  readonly requiresPermission = false;

  readonly parameters: ParameterDefinition[] = [
    {
      name: "skill_name",
      type: "string",
      required: true,
      description: "The skill name or folder name to load.",
    },
  ];

  constructor(private readonly skillManager: SkillManager) {
    super();
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const skillName = String(params.skill_name ?? "").trim();
    if (!skillName) {
      throw new Error("skill_name is required");
    }

    const skill = await this.skillManager.loadSkill(skillName);
    const resources =
      skill.resources.length === 0
        ? "No additional text resources were loaded."
        : skill.resources
            .map((resource) => {
              const suffix = resource.truncated ? "\n[content truncated]" : "";
              return [
                `## Resource: ${resource.path}`,
                resource.content.trim(),
                suffix,
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n");

    return [
      `Loaded skill: ${skill.name}`,
      `Description: ${skill.description}`,
      `Directory: ${skill.directory}`,
      "",
      "## Instructions",
      skill.instructions || "This skill does not define additional instructions.",
      "",
      "## Resources",
      resources,
      "",
      "Follow this skill's instructions for the current task whenever they apply.",
    ].join("\n");
  }
}
