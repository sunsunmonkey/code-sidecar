/**
 * Message type definitions for configuration-related communication
 * These types define the messages exchanged between the webview and extension backend
 */

import type { UIConfiguration, ValidationErrors } from './config';

/**
 * API Configuration subset for connection testing
 */
export interface ApiConfiguration {
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Messages sent from webview to extension backend
 */
export type ConfigMessage =
  | { type: 'get_configuration' }
  | { type: 'save_configuration'; config: UIConfiguration }
  | { type: 'test_connection'; apiConfig: ApiConfiguration }
  | { type: 'export_configuration' }
  | { type: 'import_configuration'; data: string }
  | { type: 'reset_to_defaults' };

/**
 * Responses sent from extension backend to webview
 */
export type ConfigResponse =
  | { type: 'configuration_loaded'; config: UIConfiguration; isFirstTime?: boolean }
  | { type: 'configuration_saved'; success: boolean; error?: string }
  | { type: 'connection_test_result'; success: boolean; error?: string; responseTime?: number }
  | { type: 'configuration_exported'; data: string }
  | { type: 'configuration_imported'; success: boolean; error?: string }
  | { type: 'validation_error'; errors: ValidationErrors };
