import * as vscode from "vscode";
import { ApiConfiguration } from "../core/apiHandler";
import { PermissionSettings } from "../managers/PermissionManager";
import { WorkMode } from "../managers/ModeManager";

/**
 * Complete plugin configuration
 */
export interface PluginConfiguration {
  /**
   * API configuration
   */
  api: ApiConfiguration;

  /**
   * Permission settings
   */
  permissions: PermissionSettings;

  /**
   * Default work mode
   */
  defaultMode: WorkMode;

  /**
   * Maximum ReAct loop iterations
   */
  maxLoopCount: number;

  /**
   * Maximum context window size
   */
  contextWindowSize: number;
}

/**
 * UI-friendly configuration format
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
 * ConfigurationManager handles reading, saving, and validating plugin configuration
 */
export class ConfigurationManager {
  private static readonly CONFIG_SECTION = "codingAgent";
  private static readonly API_KEY_SECRET = "codingAgent.apiKey";

  constructor(private context: vscode.ExtensionContext) {}



  /**
   * Get complete plugin configuration
   *
   * @returns Promise<PluginConfiguration> Complete configuration
   */
  async getConfiguration(): Promise<PluginConfiguration> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIG_SECTION
    );

    // Get API key from secure storage (Requirement 10.2)
    const apiKey = await this.getApiKey();

    const pluginConfig: PluginConfiguration = {
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
      defaultMode: config.get<WorkMode>("defaultMode", "code"),
      maxLoopCount: config.get<number>("maxLoopCount", 25),
      contextWindowSize: config.get<number>("contextWindowSize", 100000),
    };

    return pluginConfig;
  }

  /**
   * Get API key from secure storage
   * Requirement: 10.2 - Use VSCode SecretStorage for API keys
   *
   * @returns Promise<string | undefined> API key or undefined if not set
   */
  async getApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get(ConfigurationManager.API_KEY_SECRET);
  }

  /**
   * Store API key in secure storage
   * Requirement: 10.2 - Use VSCode SecretStorage for API keys
   *
   * @param apiKey API key to store
   */
  async setApiKey(apiKey: string): Promise<void> {
    await this.context.secrets.store(
      ConfigurationManager.API_KEY_SECRET,
      apiKey
    );
    console.log("[ConfigurationManager] API key stored securely");
  }

  /**
   * Delete API key from secure storage
   * Requirement: 10.2
   */
  async deleteApiKey(): Promise<void> {
    await this.context.secrets.delete(ConfigurationManager.API_KEY_SECRET);
    console.log("[ConfigurationManager] API key deleted");
  }

  /**
   * Update API configuration
   * Requirements: 10.1, 10.4
   *
   * @param apiConfig Partial API configuration to update
   */
  async updateApiConfiguration(
    apiConfig: Partial<ApiConfiguration>
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIG_SECTION
    );

    if (apiConfig.baseUrl !== undefined) {
      await config.update(
        "api.baseUrl",
        apiConfig.baseUrl,
        vscode.ConfigurationTarget.Global
      );
    }
    if (apiConfig.model !== undefined) {
      await config.update(
        "api.model",
        apiConfig.model,
        vscode.ConfigurationTarget.Global
      );
    }
    if (apiConfig.temperature !== undefined) {
      await config.update(
        "api.temperature",
        apiConfig.temperature,
        vscode.ConfigurationTarget.Global
      );
    }
    if (apiConfig.maxTokens !== undefined) {
      await config.update(
        "api.maxTokens",
        apiConfig.maxTokens,
        vscode.ConfigurationTarget.Global
      );
    }
    if (apiConfig.apiKey !== undefined) {
      await this.setApiKey(apiConfig.apiKey);
    }

    console.log("[ConfigurationManager] API configuration updated");
  }

  /**
   * Update permission settings
   * Requirement: 10.3
   *
   * @param permissions Partial permission settings to update
   */
  async updatePermissionSettings(
    permissions: Partial<PermissionSettings>
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIG_SECTION
    );

    if (permissions.allowReadByDefault !== undefined) {
      await config.update(
        "permissions.allowReadByDefault",
        permissions.allowReadByDefault,
        vscode.ConfigurationTarget.Global
      );
    }
    if (permissions.allowWriteByDefault !== undefined) {
      await config.update(
        "permissions.allowWriteByDefault",
        permissions.allowWriteByDefault,
        vscode.ConfigurationTarget.Global
      );
    }
    if (permissions.allowExecuteByDefault !== undefined) {
      await config.update(
        "permissions.allowExecuteByDefault",
        permissions.allowExecuteByDefault,
        vscode.ConfigurationTarget.Global
      );
    }
    if (permissions.alwaysConfirm !== undefined) {
      await config.update(
        "permissions.alwaysConfirm",
        permissions.alwaysConfirm,
        vscode.ConfigurationTarget.Global
      );
    }

    console.log("[ConfigurationManager] Permission settings updated");
  }

  /**
   * Update default mode
   *
   * @param mode Default work mode
   */
  async updateDefaultMode(mode: WorkMode): Promise<void> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIG_SECTION
    );
    await config.update("defaultMode", mode, vscode.ConfigurationTarget.Global);
    console.log(`[ConfigurationManager] Default mode updated to: ${mode}`);
  }

  /**
   * Update max loop count
   *
   * @param count Maximum loop count
   */
  async updateMaxLoopCount(count: number): Promise<void> {
    const config = vscode.workspace.getConfiguration(
      ConfigurationManager.CONFIG_SECTION
    );
    await config.update(
      "maxLoopCount",
      count,
      vscode.ConfigurationTarget.Global
    );
    console.log(`[ConfigurationManager] Max loop count updated to: ${count}`);
  }

  /**
   * Validate API configuration
   * Requirements: 10.3, 10.4 - Validate configuration and test API connection
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
   * Requirement: 10.5 - Prompt user if not configured
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
    callback: (config: PluginConfiguration) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration(ConfigurationManager.CONFIG_SECTION)) {
        const config = await this.getConfiguration();
        callback(config);
      }
    });
  }

  /**
   * Get configuration formatted for UI display
   * Requirement: 2.1
   *
   * @returns Promise<UIConfiguration> UI-friendly configuration
   */
  async getConfigurationForUI(): Promise<UIConfiguration> {
    const config = await this.getConfiguration();

    return {
      api: {
        baseUrl: config.api.baseUrl,
        model: config.api.model,
        apiKey: config.api.apiKey,
        temperature: config.api.temperature || 0,
        maxTokens: config.api.maxTokens || 0,
      },
      permissions: {
        allowReadByDefault: config.permissions.allowReadByDefault,
        allowWriteByDefault: config.permissions.allowWriteByDefault,
        allowExecuteByDefault: config.permissions.allowExecuteByDefault,
      },
      advanced: {
        defaultMode: config.defaultMode,
        maxLoopCount: config.maxLoopCount,
        contextWindowSize: config.contextWindowSize,
      },
    };
  }

  /**
   * Update configuration with partial updates
   * Supports batch updates of multiple configuration sections
   * Requirement: 2.1
   *
   * @param config Partial configuration to update
   */
  async updateConfiguration(
    config: Partial<PluginConfiguration>
  ): Promise<void> {
    // Update API configuration if provided
    if (config.api) {
      await this.updateApiConfiguration(config.api);
    }

    // Update permissions if provided
    if (config.permissions) {
      await this.updatePermissionSettings(config.permissions);
    }

    // Update default mode if provided
    if (config.defaultMode !== undefined) {
      await this.updateDefaultMode(config.defaultMode);
    }

    // Update max loop count if provided
    if (config.maxLoopCount !== undefined) {
      await this.updateMaxLoopCount(config.maxLoopCount);
    }

    // Update context window size if provided
    if (config.contextWindowSize !== undefined) {
      const vsConfig = vscode.workspace.getConfiguration(
        ConfigurationManager.CONFIG_SECTION
      );
      await vsConfig.update(
        "contextWindowSize",
        config.contextWindowSize,
        vscode.ConfigurationTarget.Global
      );
    }

    console.log("[ConfigurationManager] Configuration updated");
  }


}
