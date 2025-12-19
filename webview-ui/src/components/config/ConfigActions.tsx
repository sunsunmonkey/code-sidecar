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
    <section className="relative overflow-hidden rounded-2xl bg-[var(--vscode-editor-background)] px-5 md:px-6 py-5 shadow-[0_8px_22px_rgba(0,0,0,0.12)] transition-all">
      <div className="relative">
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
          <div className={`flex items-center gap-2 px-3.5 py-3 mb-2.5 rounded-2xl text-[13px] leading-snug shadow-[0_12px_36px_rgba(0,0,0,0.18)] animate-[test-result-fade-in_0.3s_ease-in-out] ${
            testResult.success
              ? 'text-[var(--vscode-testing-iconPassed,#73bf69)] bg-[rgba(115,191,105,0.12)]'
              : 'text-[var(--vscode-errorForeground)] bg-[var(--vscode-inputValidation-errorBackground)]'
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
      </div>
    </section>
  );
};
