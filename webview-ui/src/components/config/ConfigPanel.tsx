/**
 * ConfigPanel component
 * Main configuration panel that combines all configuration sections
 * Requirements: 1.1, 2.1
 */

import React from 'react';
import { useConfiguration } from '../../hooks/useConfiguration';
import './ConfigPanel.css';
import { ApiConfigSection } from './ApiConfigSection';
import { PermissionsSection } from './PermissionsSection';
import { AdvancedSection } from './AdvancedSection';
import { ConfigActions } from './ConfigActions';

/**
 * ConfigPanel component
 * Combines all configuration sections and manages overall state
 */
export const ConfigPanel: React.FC = () => {
  const {
    config,
    validationErrors,
    isLoading,
    isSaving,
    isTesting,
    testResult,
    isFirstTime,
    updateApiConfig,
    updatePermissions,
    updateAdvanced,
    saveConfiguration,
    testConnection,
    resetToDefaults,
    exportConfiguration,
    importConfiguration,
  } = useConfiguration();

  // Show loading state while configuration is being loaded
  if (isLoading || !config) {
    return (
      <div className="config-panel">
        <div className="config-loading">Loading configuration...</div>
      </div>
    );
  }

  // Check if there are any validation errors
  const hasValidationErrors = Object.values(validationErrors).some(
    error => error !== undefined
  );

  /**
   * Handle API configuration field changes
   */
  const handleApiChange = (field: string, value: string | number) => {
    updateApiConfig(field as keyof typeof config.api, value);
  };

  /**
   * Handle permissions field changes
   */
  const handlePermissionsChange = (field: string, value: boolean) => {
    updatePermissions(field as keyof typeof config.permissions, value);
  };

  /**
   * Handle advanced configuration field changes
   */
  const handleAdvancedChange = (field: string, value: string | number) => {
    updateAdvanced(field as keyof typeof config.advanced, value);
  };

  return (
    <div className="config-panel">
      <header className="config-header">
        <h1>Configuration</h1>
        <p className="config-description">
          {isFirstTime 
            ? '👋 Welcome! Let\'s set up your AI Coding Assistant to get started.'
            : 'Configure your AI Coding Assistant settings'
          }
        </p>
      </header>

      {isFirstTime && (
        <div className="setup-wizard-banner">
          <div className="setup-wizard-content">
            <h2>🚀 Quick Setup</h2>
            <p>
              To get started, you'll need to configure your API settings. 
              The required fields are marked with an asterisk (*).
            </p>
            <ol className="setup-steps">
              <li>Enter your API Base URL and Model name</li>
              <li>Provide your API Key (stored securely)</li>
              <li>Test the connection to verify your settings</li>
              <li>Save your configuration</li>
            </ol>
          </div>
        </div>
      )}

      <div className="config-content">
        <ApiConfigSection
          config={config.api}
          onChange={handleApiChange}
          errors={validationErrors}
          isFirstTime={isFirstTime}
        />

        <PermissionsSection
          permissions={config.permissions}
          onChange={handlePermissionsChange}
        />

        <AdvancedSection
          advanced={config.advanced}
          onChange={handleAdvancedChange}
          errors={validationErrors}
        />

        <ConfigActions
          onSave={saveConfiguration}
          onTestConnection={testConnection}
          onReset={resetToDefaults}
          onExport={exportConfiguration}
          onImport={importConfiguration}
          isSaving={isSaving}
          isTesting={isTesting}
          hasValidationErrors={hasValidationErrors}
          testResult={testResult}
        />
      </div>
    </div>
  );
};
