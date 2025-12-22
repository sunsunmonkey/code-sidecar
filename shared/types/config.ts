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
