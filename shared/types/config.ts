import type { ApiConfiguration } from "./api";

export type ApiConfigurationWithDefaults = ApiConfiguration & {
  temperature: number;
  maxTokens: number;
};

export interface PermissionSettings {
  allowReadByDefault: boolean;
  allowWriteByDefault: boolean;
  allowExecuteByDefault: boolean;
  alwaysConfirm?: string[];
}

export const DEFAULT_PERMISSION_SETTINGS: Required<PermissionSettings> = {
  allowReadByDefault: true,
  allowWriteByDefault: false,
  allowExecuteByDefault: false,
  alwaysConfirm: ["delete", "execute"],
};

export interface AdvancedConfiguration {
  maxLoopCount: number;
  contextWindowSize: number;
}

export interface AgentConfiguration {
  api: ApiConfigurationWithDefaults;
  permissions: PermissionSettings;
  advanced: AdvancedConfiguration;
}

export interface ValidationErrors {
  general?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  temperature?: string;
  maxTokens?: string;
  maxLoopCount?: string;
  contextWindowSize?: string;
}
