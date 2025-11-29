import React from 'react';
import './Toggle.css';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="toggle-group">
      <label className="toggle-label">{label}</label>
      <button
        className={`toggle ${checked ? 'toggle-on' : 'toggle-off'}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        type="button"
      >
        <span className="toggle-slider" />
      </button>
    </div>
  );
};
