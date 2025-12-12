/**
 * Configuration type definitions for the webview UI
 * These types define the structure of configuration data used in the configuration panel
 */

import type { WorkMode } from "./messages";

/**
 * UI Configuration interface
 * Represents the complete configuration structure used in the configuration UI
 */
export interface UIConfiguration {
  api: {
    baseUrl: string;
    model: string;
    apiKey: string;
    temperature: number;
    maxTokens: number;
  };
  permissions: {
    allowReadByDefault: boolean;
    allowWriteByDefault: boolean;
    allowExecuteByDefault: boolean;
  };
  advanced: {
    defaultMode: WorkMode;
    maxLoopCount: number;
    contextWindowSize: number;
  };
}



/**
 * Validation Errors interface
 * Maps configuration field names to their validation error messages
 */
export interface ValidationErrors {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  temperature?: string;
  maxTokens?: string;
  maxLoopCount?: string;
  contextWindowSize?: string;
}
