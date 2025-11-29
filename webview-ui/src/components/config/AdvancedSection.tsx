import React from 'react';
import { Input } from '../common/Input';
import type { WorkMode } from '../../types';
import './ConfigSection.css';

export interface AdvancedSectionProps {
  advanced: {
    defaultMode: WorkMode;
    maxLoopCount: number;
    contextWindowSize: number;
  };
  onChange: (field: string, value: string | number) => void;
  errors?: {
    maxLoopCount?: string;
    contextWindowSize?: string;
  };
}

export const AdvancedSection: React.FC<AdvancedSectionProps> = ({
  advanced,
  onChange,
  errors = {},
}) => {
  const handleModeChange = (value: string) => {
    onChange('defaultMode', value as WorkMode);
  };

  const handleMaxLoopCountChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onChange('maxLoopCount', numValue);
    }
  };

  const handleContextWindowSizeChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onChange('contextWindowSize', numValue);
    }
  };

  return (
    <section className="config-section">
      <h2>Advanced Settings</h2>
      <div className="input-group">
        <label className="input-label">Default Mode</label>
        <select
          value={advanced.defaultMode}
          onChange={(e) => handleModeChange(e.target.value)}
          className="input-field"
        >
          <option value="architect">Architect</option>
          <option value="code">Code</option>
          <option value="ask">Ask</option>
          <option value="debug">Debug</option>
        </select>
      </div>
      <Input
        label="Max Loop Count"
        type="number"
        value={advanced.maxLoopCount}
        onChange={handleMaxLoopCountChange}
        error={errors.maxLoopCount}
        min={1}
        placeholder="10"
      />
      <Input
        label="Context Window Size"
        type="number"
        value={advanced.contextWindowSize}
        onChange={handleContextWindowSizeChange}
        error={errors.contextWindowSize}
        min={1}
        placeholder="8192"
      />
    </section>
  );
};
