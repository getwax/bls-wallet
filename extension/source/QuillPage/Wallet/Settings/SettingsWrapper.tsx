import * as React from 'react';
import { SettingsSummary } from './SettingsSummary';

export interface ISettings {
  name: string;
}

const contacts: ISettings[] = [
  {
    name: 'General',
  },
  {
    name: 'Network',
  },
  {
    name: 'Security',
  },
];

export const SettingsWrapper: React.FunctionComponent = () => {
  const [selected, setSelected] = React.useState<number>(0);

  return (
    <div className="">
      <div className="flex justify-between place-items-center">
        <div className="text-body">Settings</div>
      </div>

      <div className="flex flex-col gap-4 mt-8">
        {contacts.map((contact, index) => (
          <SettingsSummary
            onClick={() => setSelected(index)}
            name={contact.name}
            key={contact.name}
            expanded={index === selected}
          />
        ))}
      </div>
    </div>
  );
};
