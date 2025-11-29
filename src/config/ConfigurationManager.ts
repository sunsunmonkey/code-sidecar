import * as vscode from 'vscode';
import { ApiConfiguration } from '../core/apiHandler';
import { PermissionSettings } from '../managers/PermissionManager';
import { WorkMode } from '../managers/ModeManager';

/**
 * Complete plugin configuration
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export interface PluginConfiguration {
  /**
   * API configuration
   * Requirements: 10.1, 10.2
   */
  api: ApiConfiguration;

  /**
   * Permission settings
   * Requirement: 10.3
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
 * Requirement: 2.1
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
 * Exported configuration format (excludes sensitive data)
 * Requirements: 5.1, 5.3
 */
export interface ExportedConfiguration {
  version: string;
  api: {
    baseUrl: string;
    model: string;
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
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 2.2 (performance optimization)
 */
export class ConfigurationManager {
  private static readonly CONFIG_SECTION = 'codingAgent';
  private static readonly API_KEY_SECRET = 'codingAgent.apiKey';
  
  // Cache for configuration to reduce redundant reads (Requirement: 2.2)
  private configCache: PluginConfiguration | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds cache TTL

  constructor(private context: vscode.ExtensionContext) {
    // Invalidate cache when configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(ConfigurationManager.CONFIG_SECTION)) {
        this.invalidateCache();
      }
    });
  }

  /**
   * Invalidate the configuration cache
   * Forces next getConfiguration call to read from storage
   */
  private invalidateCache(): void {
    this.configCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.configCache) return false;
    const now = Date.now();
    return (now - this.cacheTimestamp) < this.CACHE_TTL;
  }

  /**
   * Get complete plugin configuration
   * Requirements: 10.1, 10.2, 10.3, 2.2 (with caching for performance)
   * 
   * @param forceRefresh - Force refresh from storage, bypassing cache
   * @returns Promise<PluginConfiguration> Complete configuration
   */
  async getConfiguration(forceRefresh: boolean = false): Promise<PluginConfiguration> {
    // Return cached configuration if valid and not forcing refresh
    if (!forceRefresh && this.isCacheValid()) {
      return this.configCache!;
    }

    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
    
    // Get API key from secure storage (Requirement 10.2)
    const apiKey = await this.getApiKey();

    const pluginConfig: PluginConfiguration = {
      api: {
        baseUrl: config.get<string>('api.baseUrl', 'https://api.openai.com/v1'),
        model: config.get<string>('api.model', 'gpt-4'),
        apiKey: apiKey || '',
        temperature: config.get<number>('api.temperature', 0.7),
        maxTokens: config.get<number>('api.maxTokens', 4096),
      },
      permissions: {
        allowReadByDefault: config.get<boolean>('permissions.allowReadByDefault', true),
        allowWriteByDefault: config.get<boolean>('permissions.allowWriteByDefault', false),
        allowExecuteByDefault: config.get<boolean>('permissions.allowExecuteByDefault', false),
        alwaysConfirm: config.get<string[]>('permissions.alwaysConfirm', ['delete', 'execute']),
      },
      defaultMode: config.get<WorkMode>('defaultMode', 'code'),
      maxLoopCount: config.get<number>('maxLoopCount', 25),
      contextWindowSize: config.get<number>('contextWindowSize', 100000),
    };

    // Update cache
    this.configCache = pluginConfig;
    this.cacheTimestamp = Date.now();

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
    await this.context.secrets.store(ConfigurationManager.API_KEY_SECRET, apiKey);
    console.log('[ConfigurationManager] API key stored securely');
  }

  /**
   * Delete API key from secure storage
   * Requirement: 10.2
   */
  async deleteApiKey(): Promise<void> {
    await this.context.secrets.delete(ConfigurationManager.API_KEY_SECRET);
    console.log('[ConfigurationManager] API key deleted');
  }

  /**
   * Update API configuration
   * Requirements: 10.1, 10.4, 2.2 (invalidates cache)
   * 
   * @param apiConfig Partial API configuration to update
   */
  async updateApiConfiguration(apiConfig: Partial<ApiConfiguration>): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);

    if (apiConfig.baseUrl !== undefined) {
      await config.update('api.baseUrl', apiConfig.baseUrl, vscode.ConfigurationTarget.Global);
    }
    if (apiConfig.model !== undefined) {
      await config.update('api.model', apiConfig.model, vscode.ConfigurationTarget.Global);
    }
    if (apiConfig.temperature !== undefined) {
      await config.update('api.temperature', apiConfig.temperature, vscode.ConfigurationTarget.Global);
    }
    if (apiConfig.maxTokens !== undefined) {
      await config.update('api.maxTokens', apiConfig.maxTokens, vscode.ConfigurationTarget.Global);
    }
    if (apiConfig.apiKey !== undefined) {
      await this.setApiKey(apiConfig.apiKey);
    }

    this.invalidateCache();
    console.log('[ConfigurationManager] API configuration updated');
  }

  /**
   * Update permission settings
   * Requirement: 10.3, 2.2 (invalidates cache)
   * 
   * @param permissions Partial permission settings to update
   */
  async updatePermissionSettings(permissions: Partial<PermissionSettings>): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);

    if (permissions.allowReadByDefault !== undefined) {
      await config.update('permissions.allowReadByDefault', permissions.allowReadByDefault, vscode.ConfigurationTarget.Global);
    }
    if (permissions.allowWriteByDefault !== undefined) {
      await config.update('permissions.allowWriteByDefault', permissions.allowWriteByDefault, vscode.ConfigurationTarget.Global);
    }
    if (permissions.allowExecuteByDefault !== undefined) {
      await config.update('permissions.allowExecuteByDefault', permissions.allowExecuteByDefault, vscode.ConfigurationTarget.Global);
    }
    if (permissions.alwaysConfirm !== undefined) {
      await config.update('permissions.alwaysConfirm', permissions.alwaysConfirm, vscode.ConfigurationTarget.Global);
    }

    this.invalidateCache();
    console.log('[ConfigurationManager] Permission settings updated');
  }

  /**
   * Update default mode
   * Requirement: 2.2 (invalidates cache)
   * 
   * @param mode Default work mode
   */
  async updateDefaultMode(mode: WorkMode): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
    await config.update('defaultMode', mode, vscode.ConfigurationTarget.Global);
    this.invalidateCache();
    console.log(`[ConfigurationManager] Default mode updated to: ${mode}`);
  }

  /**
   * Update max loop count
   * Requirement: 2.2 (invalidates cache)
   * 
   * @param count Maximum loop count
   */
  async updateMaxLoopCount(count: number): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
    await config.update('maxLoopCount', count, vscode.ConfigurationTarget.Global);
    this.invalidateCache();
    console.log(`[ConfigurationManager] Max loop count updated to: ${count}`);
  }

  /**
   * Validate API configuration
   * Requirements: 10.3, 10.4 - Validate configuration and test API connection
   * 
   * @param apiConfig API configuration to validate
   * @returns Promise<{ valid: boolean; error?: string }> Validation result
   */
  async validateApiConfiguration(apiConfig: ApiConfiguration): Promise<{ valid: boolean; error?: string }> {
    // Check required fields
    if (!apiConfig.baseUrl || apiConfig.baseUrl.trim() === '') {
      return { valid: false, error: 'Base URL is required' };
    }

    if (!apiConfig.model || apiConfig.model.trim() === '') {
      return { valid: false, error: 'Model name is required' };
    }

    if (!apiConfig.apiKey || apiConfig.apiKey.trim() === '') {
      return { valid: false, error: 'API key is required' };
    }

    // Validate URL format
    try {
      new URL(apiConfig.baseUrl);
    } catch (error) {
      return { valid: false, error: 'Invalid base URL format' };
    }

    // Validate temperature range
    if (apiConfig.temperature !== undefined) {
      if (apiConfig.temperature < 0 || apiConfig.temperature > 2) {
        return { valid: false, error: 'Temperature must be between 0 and 2' };
      }
    }

    // Validate maxTokens
    if (apiConfig.maxTokens !== undefined) {
      if (apiConfig.maxTokens < 1) {
        return { valid: false, error: 'Max tokens must be at least 1' };
      }
    }

    // Test API connection (Requirement 10.4)
    try {
      const { ApiHandler } = await import('../core/apiHandler');
      const apiHandler = new ApiHandler(apiConfig);
      const isValid = await apiHandler.validateConfiguration();
      
      if (!isValid) {
        return { valid: false, error: 'API connection test failed. Please check your credentials.' };
      }

      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
    return apiKey !== undefined && apiKey.trim() !== '';
  }

  /**
   * Prompt user to configure API if not configured
   * Requirement: 10.5
   */
  async promptConfigureApiIfNeeded(): Promise<boolean> {
    const isConfigured = await this.isApiConfigured();
    
    if (!isConfigured) {
      const result = await vscode.window.showWarningMessage(
        'Coding Agent is not configured. Please configure your API settings.',
        'Configure Now',
        'Later'
      );

      if (result === 'Configure Now') {
        await vscode.commands.executeCommand('coding-agent-slim.configureApi');
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
  onConfigurationChanged(callback: (config: PluginConfiguration) => void): vscode.Disposable {
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
        temperature: config.api.temperature,
        maxTokens: config.api.maxTokens,
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
   * Requirement: 2.1, 2.2 (optimized to invalidate cache once)
   * 
   * @param config Partial configuration to update
   */
  async updateConfiguration(config: Partial<PluginConfiguration>): Promise<void> {
    // Temporarily disable cache invalidation for batch updates
    const originalInvalidate = this.invalidateCache.bind(this);
    let shouldInvalidate = false;
    
    // Override invalidateCache to track if we need to invalidate
    this.invalidateCache = () => { shouldInvalidate = true; };

    try {
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
        const vsConfig = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        await vsConfig.update('contextWindowSize', config.contextWindowSize, vscode.ConfigurationTarget.Global);
        shouldInvalidate = true;
      }

      console.log('[ConfigurationManager] Configuration updated');
    } finally {
      // Restore original invalidateCache and invalidate once if needed
      this.invalidateCache = originalInvalidate;
      if (shouldInvalidate) {
        this.invalidateCache();
      }
    }
  }

  /**
   * Reset all configuration to default values
   * Requirement: 2.4, 2.2 (invalidates cache)
   */
  async resetToDefaults(): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);

    // Reset API settings
    await config.update('api.baseUrl', 'https://api.openai.com/v1', vscode.ConfigurationTarget.Global);
    await config.update('api.model', 'gpt-4', vscode.ConfigurationTarget.Global);
    await config.update('api.temperature', 0.7, vscode.ConfigurationTarget.Global);
    await config.update('api.maxTokens', 4096, vscode.ConfigurationTarget.Global);

    // Reset permissions
    await config.update('permissions.allowReadByDefault', true, vscode.ConfigurationTarget.Global);
    await config.update('permissions.allowWriteByDefault', false, vscode.ConfigurationTarget.Global);
    await config.update('permissions.allowExecuteByDefault', false, vscode.ConfigurationTarget.Global);
    await config.update('permissions.alwaysConfirm', ['delete', 'execute'], vscode.ConfigurationTarget.Global);

    // Reset advanced settings
    await config.update('defaultMode', 'code', vscode.ConfigurationTarget.Global);
    await config.update('maxLoopCount', 25, vscode.ConfigurationTarget.Global);
    await config.update('contextWindowSize', 100000, vscode.ConfigurationTarget.Global);

    this.invalidateCache();
    // Note: API key is not reset for security reasons
    console.log('[ConfigurationManager] Configuration reset to defaults');
  }

  /**
   * Export configuration to JSON format (excludes sensitive data)
   * Requirements: 5.1, 5.3
   * 
   * @returns Promise<ExportedConfiguration> Exported configuration
   */
  async exportConfiguration(): Promise<ExportedConfiguration> {
    const config = await this.getConfiguration();

    return {
      version: '1.0.0',
      api: {
        baseUrl: config.api.baseUrl,
        model: config.api.model,
        temperature: config.api.temperature,
        maxTokens: config.api.maxTokens,
        // API key is intentionally excluded for security (Requirement 5.3)
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
   * Import configuration from exported format
   * Requirements: 5.2, 5.5
   * 
   * @param exportedConfig Exported configuration to import
   * @throws Error if configuration is invalid
   */
  async importConfiguration(exportedConfig: ExportedConfiguration): Promise<void> {
    // Validate configuration format (Requirement 5.5)
    if (!exportedConfig.version) {
      throw new Error('Invalid configuration: missing version');
    }

    if (!exportedConfig.api || !exportedConfig.permissions || !exportedConfig.advanced) {
      throw new Error('Invalid configuration: missing required sections');
    }

    // Validate API configuration
    if (!exportedConfig.api.baseUrl || typeof exportedConfig.api.baseUrl !== 'string') {
      throw new Error('Invalid configuration: invalid API base URL');
    }

    if (!exportedConfig.api.model || typeof exportedConfig.api.model !== 'string') {
      throw new Error('Invalid configuration: invalid API model');
    }

    if (typeof exportedConfig.api.temperature !== 'number' || 
        exportedConfig.api.temperature < 0 || 
        exportedConfig.api.temperature > 2) {
      throw new Error('Invalid configuration: temperature must be between 0 and 2');
    }

    if (typeof exportedConfig.api.maxTokens !== 'number' || exportedConfig.api.maxTokens < 1) {
      throw new Error('Invalid configuration: maxTokens must be at least 1');
    }

    // Validate permissions
    if (typeof exportedConfig.permissions.allowReadByDefault !== 'boolean' ||
        typeof exportedConfig.permissions.allowWriteByDefault !== 'boolean' ||
        typeof exportedConfig.permissions.allowExecuteByDefault !== 'boolean') {
      throw new Error('Invalid configuration: invalid permission settings');
    }

    // Validate advanced settings
    if (typeof exportedConfig.advanced.maxLoopCount !== 'number' || exportedConfig.advanced.maxLoopCount < 1) {
      throw new Error('Invalid configuration: maxLoopCount must be at least 1');
    }

    if (typeof exportedConfig.advanced.contextWindowSize !== 'number' || exportedConfig.advanced.contextWindowSize < 1) {
      throw new Error('Invalid configuration: contextWindowSize must be at least 1');
    }

    // Apply configuration (Requirement 5.2)
    await this.updateConfiguration({
      api: {
        baseUrl: exportedConfig.api.baseUrl,
        model: exportedConfig.api.model,
        temperature: exportedConfig.api.temperature,
        maxTokens: exportedConfig.api.maxTokens,
        // API key must be set separately by the user
      },
      permissions: {
        allowReadByDefault: exportedConfig.permissions.allowReadByDefault,
        allowWriteByDefault: exportedConfig.permissions.allowWriteByDefault,
        allowExecuteByDefault: exportedConfig.permissions.allowExecuteByDefault,
      },
      defaultMode: exportedConfig.advanced.defaultMode,
      maxLoopCount: exportedConfig.advanced.maxLoopCount,
      contextWindowSize: exportedConfig.advanced.contextWindowSize,
    });

    console.log('[ConfigurationManager] Configuration imported successfully');
  }
}
