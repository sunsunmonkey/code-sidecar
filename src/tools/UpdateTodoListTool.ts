import { BaseTool, ParameterDefinition } from "./Tool";
import type {
  TodoItem,
  TodoList,
  TodoStatus,
} from "code-sidecar-shared/types/todo";

const VALID_STATUSES = new Set<TodoStatus>([
  "pending",
  "in_progress",
  "done",
]);

type RawTodoItem = Record<string, unknown>;

export class UpdateTodoListTool extends BaseTool {
  readonly name = "update_todo_list";
  readonly description =
    "Update the current task todo list for progress tracking. Provide a JSON array of items with id, title, status (pending|in_progress|done), and optional description.";
  readonly requiresPermission = false;

  readonly parameters: ParameterDefinition[] = [
    {
      name: "items",
      type: "array",
      required: true,
      description:
        "JSON array of todo items: [{\"id\":\"1\",\"title\":\"...\",\"status\":\"pending\"}].",
    },
  ];

  constructor(private onUpdate: (todoList: TodoList) => void) {
    super();
  }

  private normalizeStatus(value: string): TodoStatus {
    const normalized = value.trim().toLowerCase().replace("-", "_");
    if (VALID_STATUSES.has(normalized as TodoStatus)) {
      return normalized as TodoStatus;
    }
    throw new Error(`Invalid todo status: ${value}`);
  }

  private normalizeItem(entry: unknown, index: number): TodoItem {
    if (!entry || typeof entry !== "object") {
      throw new Error("Each todo item must be an object.");
    }

    const record = entry as RawTodoItem;
    const titleValue =
      record.title ?? record.text ?? record.label ?? record.name;

    if (typeof titleValue !== "string" || !titleValue.trim()) {
      throw new Error("Each todo item requires a title.");
    }

    const statusValue =
      typeof record.status === "string" ? record.status : "pending";
    const idValue =
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : `todo-${index + 1}`;
    let descriptionValue: string | undefined;
    if (typeof record.description === "string") {
      descriptionValue = record.description;
    } else if (typeof record.details === "string") {
      descriptionValue = record.details;
    }

    return {
      id: idValue,
      title: titleValue.trim(),
      status: this.normalizeStatus(statusValue),
      description: descriptionValue?.trim() || undefined,
    };
  }

  private parseItems(value: unknown): TodoItem[] {
    let itemsValue = value;
    if (typeof itemsValue === "string") {
      const trimmed = itemsValue.trim();
      if (!trimmed) {
        return [];
      }
      itemsValue = JSON.parse(trimmed) as unknown;
    }

    if (!Array.isArray(itemsValue)) {
      throw new Error("Todo items must be an array.");
    }

    return itemsValue.map((entry, index) => this.normalizeItem(entry, index));
  }

  override validate(params: Record<string, unknown>): boolean {
    if (!params || !("items" in params)) {
      return false;
    }

    try {
      params.items = this.parseItems(params.items);
    } catch {
      return false;
    }

    return super.validate(params);
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const items = params.items as TodoItem[];
    this.onUpdate({ items });

    return `Updated todo list with ${items.length} item(s).`;
  }
}
