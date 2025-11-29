import React from 'react';
import './Button.css';

export interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  type = 'button',
}) => {
  return (
    <button
      type={type}
      className={`button button-${variant} ${loading ? 'button-loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <span className="button-spinner" />}
      <span className={loading ? 'button-text-loading' : ''}>{children}</span>
    </button>
  );
};
