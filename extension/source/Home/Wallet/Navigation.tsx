import * as React from 'react';
import {
  List,
  CaretDoubleLeft,
  Wallet,
  Link as LinkIcon,
  AddressBook,
  GearSix,
  Lock,
} from 'phosphor-react';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import QuillHeading from '../../components/QuillHeading';

const navigationTargets = [
  {
    name: 'Wallets',
    icon: <Wallet className="icon-md" />,
    target: '/wallets',
  },
  {
    name: 'Connections',
    icon: <LinkIcon className="icon-md" />,
    target: '/connections',
  },
  {
    name: 'Contacts',
    icon: <AddressBook className="icon-md" />,
    target: '/contacts',
  },
  {
    name: 'Settings',
    icon: <GearSix className="icon-md" />,
    target: '/settings/*',
    link: '/settings/general',
  },
];

export const Navigation: React.FunctionComponent = () => {
  const { pathname } = useLocation();
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const isCurrentRoute = (target: string) => {
    if (pathname === target) {
      return true;
    }

    if (target.endsWith('/*') && pathname.startsWith(target.slice(0, -1))) {
      return true;
    }

    return false;
  };

  return (
    <nav className="flex">
      <div
        className={`${
          sidebarVisible ? 'absolute' : 'flex-1'
        } items-center justify-center`}
      >
        <button
          className="p-4 lg:hidden"
          type="button"
          onClick={() => setSidebarVisible(!sidebarVisible)}
        >
          {sidebarVisible ? (
            <CaretDoubleLeft className="icon-md" />
          ) : (
            <List className="icon-md" />
          )}
        </button>
        <div
          className={`${
            sidebarVisible ? 'hidden' : 'flex-1'
          } p-2 lg:hidden mt-4 flex flex-col gap-4 justify-items-center`}
        >
          {navigationTargets.map((item) => (
            <Link to={item.link ?? item.target} key={item.name}>
              <div
                className={`flex gap-4 p-2 rounded-lg ${
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
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div
        className={`w-52 px-4 py-12 ${
          sidebarVisible ? 'block' : 'hidden'
        } lg:block lg:flex-shrink-0`}
      >
        <QuillHeading />
        <div className="mt-8 flex flex-col gap-4 justify-items-center">
          {navigationTargets.map((item) => (
            <Link to={item.link ?? item.target} key={item.name}>
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
          ))}
        </div>
        <div className="flex gap-2 p-3 rounded-lg mt-20">
          <Lock className="icon-md" />
          Lock
        </div>
      </div>
    </nav>
  );
};
