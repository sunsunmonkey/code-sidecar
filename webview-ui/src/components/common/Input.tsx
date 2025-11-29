import React from 'react';
import './Input.css';

export interface InputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  type?: 'text' | 'password' | 'number';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  min,
  max,
  step,
  disabled = false,
  required = false,
}) => {
  return (
    <div className={`input-group ${required ? 'required-field' : ''}`}>
      <label className="input-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input-field ${error ? 'input-error' : ''} ${required ? 'required' : ''}`}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        required={required}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};
