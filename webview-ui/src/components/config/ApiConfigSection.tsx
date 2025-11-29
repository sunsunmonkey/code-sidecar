import React from 'react';
import { Input } from '../common/Input';
import './ConfigSection.css';

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
  isFirstTime?: boolean;
}

export const ApiConfigSection: React.FC<ApiConfigSectionProps> = ({
  config,
  onChange,
  errors = {},
  isFirstTime = false,
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
    <section className={`config-section ${isFirstTime ? 'first-time-highlight' : ''}`}>
      <h2>API Settings {isFirstTime && <span className="required-indicator">*Required</span>}</h2>
      <Input
        label={`Base URL${isFirstTime ? ' *' : ''}`}
        value={config.baseUrl}
        onChange={handleBaseUrlChange}
        error={errors.baseUrl}
        placeholder="https://api.openai.com/v1"
        type="text"
        required={isFirstTime}
      />
      <Input
        label={`Model Name${isFirstTime ? ' *' : ''}`}
        value={config.model}
        onChange={handleModelChange}
        error={errors.model}
        placeholder="gpt-4"
        type="text"
        required={isFirstTime}
      />
      <Input
        label={`API Key${isFirstTime ? ' *' : ''}`}
        type="password"
        value={config.apiKey}
        onChange={handleApiKeyChange}
        error={errors.apiKey}
        placeholder="sk-..."
        required={isFirstTime}
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
    </section>
  );
};
