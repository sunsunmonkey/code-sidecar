/**
 * Managers module exports
 */
export { ModeManager, ModeDefinition } from "./ModeManager";
export { PermissionManager } from "./PermissionManager";
export type { PermissionSettings } from "code-sidecar-shared/types/config";
export {
  ConversationHistoryManager,
  ConversationEntry,
  HistoryConfig,
} from "./ConversationHistoryManager";
export {
  ErrorHandler,
  ErrorType,
  ErrorContext,
  ErrorResponse,
  ErrorLogEntry,
} from "./ErrorHandler";
export {
  ContextCollector,
  DiagnosticInfo,
  FileNode,
  ProjectContext,
} from "./ContextCollector";
export { PromptBuilder } from "./PromptBuilder";

