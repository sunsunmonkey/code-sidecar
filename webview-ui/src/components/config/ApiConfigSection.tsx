import React from 'react';
import { Input } from '../common/Input';

export interface ApiConfigSectionProps {
  config: {
    baseUrl: string;
    model: string;
    apiKey: string;
    temperature: number;
    maxTokens: number;
  };
  onChange: (field: string, value: string | number) => void;
  errors?: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    temperature?: string;
    maxTokens?: string;
  };
}

export const ApiConfigSection: React.FC<ApiConfigSectionProps> = ({
  config,
  onChange,
  errors = {},
}) => {
  // Real-time validation handlers
  const handleBaseUrlChange = (value: string) => {
    onChange('baseUrl', value);
  };

  const handleModelChange = (value: string) => {
    onChange('model', value);
  };

  const handleApiKeyChange = (value: string) => {
    onChange('apiKey', value);
  };

  const handleTemperatureChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onChange('temperature', numValue);
    }
  };

  const handleMaxTokensChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onChange('maxTokens', numValue);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[var(--vscode-editor-background)] px-5 md:px-6 py-5 shadow-[0_8px_22px_rgba(0,0,0,0.12)] transition-all">
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-[var(--vscode-foreground)] m-0">
            API Settings
          </h2>
        </div>
        <Input
          label="Base URL"
          value={config.baseUrl}
          onChange={handleBaseUrlChange}
          error={errors.baseUrl}
          placeholder="https://api.openai.com/v1"
          type="text"
        />
        <Input
          label="Model Name"
          value={config.model}
          onChange={handleModelChange}
          error={errors.model}
          placeholder="gpt-4"
          type="text"
        />
        <Input
          label="API Key"
          type="password"
          value={config.apiKey}
          onChange={handleApiKeyChange}
          error={errors.apiKey}
          placeholder="sk-..."
        />
        <Input
          label="Temperature"
          type="number"
          value={config.temperature}
          onChange={handleTemperatureChange}
          error={errors.temperature}
          min={0}
          max={2}
          step={0.1}
          placeholder="0.7"
        />
        <Input
          label="Max Tokens"
          type="number"
          value={config.maxTokens}
          onChange={handleMaxTokensChange}
          error={errors.maxTokens}
          min={1}
          placeholder="4096"
        />
      </div>
    </section>
  );
};
