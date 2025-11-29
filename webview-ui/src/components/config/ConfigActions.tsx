import React from 'react';
import { Button } from '../common/Button';
import './ConfigActions.css';

export interface ConfigActionsProps {
  onSave: () => void;
  onTestConnection: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (data: string) => void;
  isSaving?: boolean;
  isTesting?: boolean;
  hasValidationErrors?: boolean;
  testResult?: { success: boolean; error?: string; responseTime?: number } | null;
}

/**
 * ConfigActions component
 * Provides action buttons for configuration management
 * Requirements: 2.4, 5.1, 5.2, 6.1
 */
export const ConfigActions: React.FC<ConfigActionsProps> = ({
  onSave,
  onTestConnection,
  onReset,
  onExport,
  onImport,
  isSaving = false,
  isTesting = false,
  hasValidationErrors = false,
  testResult = null,
}) => {
  /**
   * Handle file import
   * Opens a file input dialog for importing configuration
   */
  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const data = event.target?.result as string;
          onImport(data);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <section className="config-actions">
      <div className="config-actions-primary">
        <Button
          onClick={onSave}
          variant="primary"
          disabled={hasValidationErrors || isSaving || isTesting}
          loading={isSaving}
        >
          Save Configuration
        </Button>
        <Button
          onClick={onTestConnection}
          variant="secondary"
          disabled={hasValidationErrors || isSaving || isTesting}
          loading={isTesting}
        >
          Test Connection
        </Button>
      </div>

      {testResult && (
        <div className={`test-result ${testResult.success ? 'test-result-success' : 'test-result-error'}`}>
          {testResult.success ? (
            <>
              <span className="test-result-icon">✓</span>
              <span>
                Connection successful
                {testResult.responseTime && ` (${testResult.responseTime}ms)`}
              </span>
            </>
          ) : (
            <>
              <span className="test-result-icon">✗</span>
              <span>{testResult.error || 'Connection failed'}</span>
            </>
          )}
        </div>
      )}

      <div className="config-actions-secondary">
        <Button
          onClick={onReset}
          variant="secondary"
          disabled={isSaving || isTesting}
        >
          Reset to Defaults
        </Button>
        <Button
          onClick={onExport}
          variant="secondary"
          disabled={isSaving || isTesting}
        >
          Export Configuration
        </Button>
        <Button
          onClick={handleImportClick}
          variant="secondary"
          disabled={isSaving || isTesting}
        >
          Import Configuration
        </Button>
      </div>
    </section>
  );
};
