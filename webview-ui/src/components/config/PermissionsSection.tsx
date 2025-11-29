import React from 'react';
import { Toggle } from '../common/Toggle';
import './ConfigSection.css';

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
    <section className="config-section">
      <h2>Permission Settings</h2>
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
    </section>
  );
};
