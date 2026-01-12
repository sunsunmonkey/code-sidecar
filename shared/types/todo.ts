export type TodoStatus = "pending" | "in_progress" | "done";

export interface TodoItem {
  id: string;
  title: string;
  status: TodoStatus;
  description?: string;
}

export interface TodoList {
  items: TodoItem[];
}
