import React from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '../common/Button';

export interface ConfigActionsProps {
  onSave: () => void;
  onTestConnection: () => void;
  isSaving?: boolean;
  isTesting?: boolean;
  hasValidationErrors?: boolean;
  testResult?: { success: boolean; error?: string; responseTime?: number } | null;
}

/**
 * ConfigActions component
 * Provides action buttons for configuration management
 * Requirements: 6.1
 */
export const ConfigActions: React.FC<ConfigActionsProps> = ({
  onSave,
  onTestConnection,
  isSaving = false,
  isTesting = false,
  hasValidationErrors = false,
  testResult = null,
}) => {

  return (
    <section className="p-4 mb-4 border border-[var(--vscode-panel-border)] rounded bg-[var(--vscode-editor-background)]">
      <div className="flex gap-3 mb-3 flex-wrap items-center">
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
        <div className={`flex items-center gap-2 px-3 py-2 mb-3 rounded-sm text-[13px] leading-snug animate-[test-result-fade-in_0.3s_ease-in-out] ${
          testResult.success
            ? 'text-[var(--vscode-testing-iconPassed,#73bf69)] bg-[var(--vscode-inputValidation-infoBackground,rgba(100,150,255,0.15))] border border-[var(--vscode-inputValidation-infoBorder,var(--vscode-testing-iconPassed))]'
            : 'text-[var(--vscode-errorForeground)] bg-[var(--vscode-inputValidation-errorBackground)] border border-[var(--vscode-inputValidation-errorBorder)]'
        }`}>
          {testResult.success ? (
            <>
              <Check size={16} strokeWidth={2.4} className="flex-shrink-0" />
              <span className="flex-1 break-words">
                Connection successful
                {testResult.responseTime && ` (${testResult.responseTime}ms)`}
              </span>
            </>
          ) : (
            <>
              <X size={16} strokeWidth={2.4} className="flex-shrink-0" />
              <span className="flex-1 break-words">{testResult.error || 'Connection failed'}</span>
            </>
          )}
        </div>
      )}


    </section>
  );
};
