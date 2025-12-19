/**
 * ConfigPanel component
 * Main configuration panel that combines all configuration sections
 */

import React from "react";
import { useConfiguration } from "../../hooks/useConfiguration";
import { ApiConfigSection } from "./ApiConfigSection";
import { PermissionsSection } from "./PermissionsSection";
import { AdvancedSection } from "./AdvancedSection";
import { ConfigActions } from "./ConfigActions";

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
    updateApiConfig,
    updatePermissions,
    updateAdvanced,
    saveConfiguration,
    testConnection,
  } = useConfiguration();

  // Show loading state while configuration is being loaded
  if (isLoading || !config) {
    return (
      <div className="flex flex-col h-full w-full overflow-y-auto bg-(--vscode-sideBar-background)">
        <div className="flex items-center justify-center h-full text-sm text-(--vscode-foreground) opacity-70">
          Loading configuration...
        </div>
      </div>
    );
  }

  // Check if there are any validation errors
  const hasValidationErrors = Object.values(validationErrors).some(
    (error) => error !== undefined
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
    <div className="relative flex flex-col h-full w-full overflow-y-auto bg-(--vscode-sideBar-background) text-(--vscode-foreground) [&_*:focus-visible]:outline [&_*:focus-visible]:outline-1 [&_*:focus-visible]:outline-offset-2 [&_*:focus-visible]:outline-[var(--vscode-focusBorder)]">
      <div className="relative flex flex-col flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 pb-6 md:pb-8 gap-5">
        <ApiConfigSection
          config={config.api}
          onChange={handleApiChange}
          errors={validationErrors}
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
          isSaving={isSaving}
          isTesting={isTesting}
          hasValidationErrors={hasValidationErrors}
          testResult={testResult}
        />
      </div>
    </div>
  );
};
