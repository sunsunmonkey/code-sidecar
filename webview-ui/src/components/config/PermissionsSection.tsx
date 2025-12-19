import React from 'react';
import { Toggle } from '../common/Toggle';

export interface PermissionsSectionProps {
  permissions: {
    allowReadByDefault: boolean;
    allowWriteByDefault: boolean;
    allowExecuteByDefault: boolean;
  };
  onChange: (field: string, value: boolean) => void;
}

export const PermissionsSection: React.FC<PermissionsSectionProps> = ({
  permissions,
  onChange,
}) => {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[var(--vscode-editor-background)] px-5 md:px-6 py-5 shadow-[0_8px_22px_rgba(0,0,0,0.12)] transition-all">
      <div className="relative">
        <h2 className="text-base font-semibold text-[var(--vscode-foreground)] m-0 mb-2.5">
          Permission Settings
        </h2>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] m-0 mb-2.5 leading-relaxed">
          Choose what the assistant can do by default before asking for approval.
        </p>
        <Toggle
          label="Allow Read by Default"
          checked={permissions.allowReadByDefault}
          onChange={(checked) => onChange('allowReadByDefault', checked)}
        />
        <Toggle
          label="Allow Write by Default"
          checked={permissions.allowWriteByDefault}
          onChange={(checked) => onChange('allowWriteByDefault', checked)}
        />
        <Toggle
          label="Allow Execute by Default"
          checked={permissions.allowExecuteByDefault}
          onChange={(checked) => onChange('allowExecuteByDefault', checked)}
        />
      </div>
    </section>
  );
};
