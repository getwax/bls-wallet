import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  {
    name: 'Developer',
  },
];

export const SettingsWrapper: React.FunctionComponent = () => {
  const { pathname } = useLocation();

  return (
    <div className="">
      <div className="flex justify-between place-items-center">
        <div className="text-body">Settings</div>
      </div>

      <div className="flex flex-col gap-4 mt-8">
        {contacts.map((contact) => {
          const linkTo = `/wallet/settings/${contact.name.toLowerCase()}`;

          return (
            <Link to={linkTo} key={contact.name}>
              <SettingsSummary
                name={contact.name}
                key={contact.name}
                expanded={pathname === linkTo}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
};
