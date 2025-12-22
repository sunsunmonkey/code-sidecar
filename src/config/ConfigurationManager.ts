import * as vscode from "vscode";

import { PermissionSettings } from "../managers/PermissionManager";
import { logger } from "coding-agent-shared/utils/logger";

import { ApiConfiguration } from "coding-agent-shared/types/api";
import type { AgentConfiguration } from "coding-agent-shared/types/config";

/**
 * ConfigurationManager handles reading, saving, and validating plugin configuration
 */
export class ConfigurationManager {
  private static readonly CONFIG_SECTION = "codingAgent";
  private static readonly API_KEY_SECRET = "codingAgent.apiKey";

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Generic method to update multiple configuration keys
   */
  private async updateConfigKeys(
    updates: Array<{ key: string; value: any }>
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIG_SECTION
    );

    await Promise.all(
      updates
        .filter(({ value }) => value !== undefined)
        .map(({ key, value }) =>
          config.update(key, value, vscode.ConfigurationTarget.Global)
        )
    );
  }

  /**
   * Get complete plugin configuration
   *
   * @returns Promise<AgentConfiguration> Complete configuration
   */
  async getConfiguration(): Promise<AgentConfiguration> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIG_SECTION
    );

    // Get API key from secure storage (Requirement 10.2)
    const apiKey = await this.getApiKey();

    const pluginConfig: AgentConfiguration = {
      api: {
        baseUrl: config.get<string>("api.baseUrl", ""),
        model: config.get<string>("api.model", ""),
        apiKey: apiKey || "",
        temperature: config.get<number>("api.temperature", 0.7),
        maxTokens: config.get<number>("api.maxTokens", 4096),
      },
      permissions: {
        allowReadByDefault: config.get<boolean>(
          "permissions.allowReadByDefault",
          true
        ),
        allowWriteByDefault: config.get<boolean>(
          "permissions.allowWriteByDefault",
          false
        ),
        allowExecuteByDefault: config.get<boolean>(
          "permissions.allowExecuteByDefault",
          false
        ),
        alwaysConfirm: config.get<string[]>("permissions.alwaysConfirm", [
          "delete",
          "execute",
        ]),
      },
      advanced: {
        maxLoopCount: config.get<number>("maxLoopCount", 25),
        contextWindowSize: config.get<number>("contextWindowSize", 100000),
      },
    };

    return pluginConfig;
  }

  /**
   * Get API key from secure storage
   *
   * @returns Promise<string | undefined> API key or undefined if not set
   */
  async getApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get(ConfigurationManager.API_KEY_SECRET);
  }

  /**
   * Store API key in secure storage
   *
   * @param apiKey API key to store
   */
  async setApiKey(apiKey: string): Promise<void> {
    await this.context.secrets.store(
      ConfigurationManager.API_KEY_SECRET,
      apiKey
    );
  }

  /**
   * Update API configuration
   * @param apiConfig Partial API configuration to update
   */
  async updateApiConfiguration(
    apiConfig: Partial<ApiConfiguration>
  ): Promise<void> {
    // Batch update all API config fields except apiKey
    await this.updateConfigKeys([
      { key: "api.baseUrl", value: apiConfig.baseUrl },
      { key: "api.model", value: apiConfig.model },
      { key: "api.temperature", value: apiConfig.temperature },
      { key: "api.maxTokens", value: apiConfig.maxTokens },
    ]);

    // Handle apiKey separately (secure storage)
    if (apiConfig.apiKey !== undefined) {
      await this.setApiKey(apiConfig.apiKey);
    }

    logger.debug("[ConfigurationManager] API configuration updated");
  }

  /**
   * Update permission settings
   *
   * @param permissions Partial permission settings to update
   */
  async updatePermissionSettings(
    permissions: Partial<PermissionSettings>
  ): Promise<void> {
    await this.updateConfigKeys([
      {
        key: "permissions.allowReadByDefault",
        value: permissions.allowReadByDefault,
      },
      {
        key: "permissions.allowWriteByDefault",
        value: permissions.allowWriteByDefault,
      },
      {
        key: "permissions.allowExecuteByDefault",
        value: permissions.allowExecuteByDefault,
      },
      { key: "permissions.alwaysConfirm", value: permissions.alwaysConfirm },
    ]);

    logger.debug("[ConfigurationManager] Permission settings updated");
  }

  /**
   * Validate API configuration
   *
   * @param apiConfig API configuration to validate
   * @returns Promise<{ valid: boolean; error?: string }> Validation result
   */
  async validateApiConfiguration(
    apiConfig: ApiConfiguration
  ): Promise<{ valid: boolean; error?: string }> {
    // Check required fields
    if (!apiConfig.baseUrl || apiConfig.baseUrl.trim() === "") {
      return { valid: false, error: "Base URL is required" };
    }

    if (!apiConfig.model || apiConfig.model.trim() === "") {
      return { valid: false, error: "Model name is required" };
    }

    if (!apiConfig.apiKey || apiConfig.apiKey.trim() === "") {
      return { valid: false, error: "API key is required" };
    }

    // Validate URL format
    try {
      new URL(apiConfig.baseUrl);
    } catch (error) {
      return { valid: false, error: "Invalid base URL format" };
    }

    // Validate temperature range
    if (apiConfig.temperature !== undefined) {
      if (apiConfig.temperature < 0 || apiConfig.temperature > 2) {
        return { valid: false, error: "Temperature must be between 0 and 2" };
      }
    }

    // Validate maxTokens
    if (apiConfig.maxTokens !== undefined) {
      if (apiConfig.maxTokens < 1) {
        return { valid: false, error: "Max tokens must be at least 1" };
      }
    }

    // Test API connection (Requirement 10.4)
    try {
      const { ApiHandler } = await import("../core/apiHandler.js");
      const apiHandler = new ApiHandler(apiConfig);
      const isValid = await apiHandler.validateConfiguration();

      if (!isValid) {
        return {
          valid: false,
          error: "API connection test failed. Please check your credentials.",
        };
      }

      return { valid: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { valid: false, error: `API validation error: ${errorMessage}` };
    }
  }

  /**
   * Check if API is configured
   *
   * @returns Promise<boolean> True if API is configured
   */
  async isApiConfigured(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return apiKey !== undefined && apiKey.trim() !== "";
  }

  /**
   * Prompt user to configure API if not configured
   * Requirement: 10.5
   */
  async promptConfigureApiIfNeeded(): Promise<boolean> {
    const isConfigured = await this.isApiConfigured();

    if (!isConfigured) {
      const result = await vscode.window.showWarningMessage(
        "Coding Agent is not configured. Please configure your API settings.",
        "Configure Now",
        "Later"
      );

      if (result === "Configure Now") {
        await vscode.commands.executeCommand("coding-agent-slim.configureApi");
        // Check again after configuration
        return await this.isApiConfigured();
      }

      return false;
    }

    return true;
  }

  /**
   * Listen for configuration changes
   *
   * @param callback Callback to invoke when configuration changes
   * @returns Disposable to stop listening
   */
  onConfigurationChanged(
    callback: (config: AgentConfiguration) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration(ConfigurationManager.CONFIG_SECTION)) {
        const config = await this.getConfiguration();
        callback(config);
      }
    });
  }

  /**
   * Update configuration with partial updates
   * Supports batch updates of multiple configuration sections
   *
   * @param config Partial configuration to update
   */
  async updateConfiguration(
    config: Partial<AgentConfiguration>
  ): Promise<void> {
    const updatePromises: Promise<void>[] = [];

    // Update simple fields
    await this.updateConfigKeys([
      { key: "maxLoopCount", value: config.advanced?.maxLoopCount },
      { key: "contextWindowSize", value: config.advanced?.contextWindowSize },
    ]);

    // Handle complex objects separately
    if (config.api) {
      updatePromises.push(this.updateApiConfiguration(config.api));
    }

    if (config.permissions) {
      updatePromises.push(this.updatePermissionSettings(config.permissions));
    }

    await Promise.all(updatePromises);
    logger.debug("[ConfigurationManager] Configuration updated");
  }
}
