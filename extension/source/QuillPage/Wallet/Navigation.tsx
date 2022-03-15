import * as React from 'react';
import {
  Wallet,
  Link as LinkIcon,
  AddressBook,
  GearSix,
  Lock,
} from 'phosphor-react';
import { Link, useLocation } from 'react-router-dom';
import QuillHeading from '../../components/QuillHeading';

const navigationTargets = [
  {
    name: 'Wallets',
    icon: <Wallet className="icon-md" />,
    target: '/wallet',
  },
  {
    name: 'Connections',
    icon: <LinkIcon className="icon-md" />,
    target: '/wallet/connections',
  },
  {
    name: 'Contacts',
    icon: <AddressBook className="icon-md" />,
    target: '/wallet/contacts',
  },
  {
    name: 'Settings',
    icon: <GearSix className="icon-md" />,
    target: '/wallet/settings',
  },
];

export const Navigation: React.FunctionComponent = () => {
  const { pathname } = useLocation();

  const isCurrentRoute = (target: string) => {
    return pathname === target;
  };

  return (
    <div className="flex flex-col w-52 px-4 py-12">
      <QuillHeading />
      <div className="mt-8 flex flex-col gap-4 justify-items-center">
        {navigationTargets.map((item) => {
          return (
            <Link to={item.target} key={item.name}>
              <div
                className={`flex gap-4 p-3 rounded-lg ${
                  isCurrentRoute(item.target) && 'bg-grey-200'
                }`}
              >
                <span
                  className={`${
                    isCurrentRoute(item.target) && 'text-blue-500'
                  }`}
                >
                  {item.icon}
                </span>
                {item.name}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="flex gap-2 p-3 rounded-lg mt-20">
        <Lock className="icon-md" />
        Lock
      </div>
    </div>
  );
};
