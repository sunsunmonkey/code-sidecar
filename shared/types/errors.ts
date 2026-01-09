export const ErrorType = {
  API_ERROR: "api_error",
  TOOL_ERROR: "tool_error",
  PARSING_ERROR: "parsing_error",
  NETWORK_ERROR: "network_error",
  PERMISSION_ERROR: "permission_error",
  CONFIGURATION_ERROR: "configuration_error",
  SYSTEM_ERROR: "system_error",
  UNKNOWN_ERROR: "unknown_error",
} as const;

export type ErrorType = (typeof ErrorType)[keyof typeof ErrorType];

export type ErrorPayload = {
  type: ErrorType;
  message: string;
  recoveryAction?: string;
  retryable?: boolean;
  operation?: string;
  technicalDetails?: string;
};
