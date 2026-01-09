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
} from "./ErrorHandler";
export {
  AppError,
  ErrorContext,
  ErrorResponse,
  ErrorLogEntry,
} from "./errorTypes";
export type { ErrorStatistics } from "./errorStatistics";
export { ErrorType } from "code-sidecar-shared/types/errors";
export {
  ContextCollector,
  DiagnosticInfo,
  FileNode,
  ProjectContext,
} from "./ContextCollector";
export { PromptBuilder } from "./PromptBuilder";

