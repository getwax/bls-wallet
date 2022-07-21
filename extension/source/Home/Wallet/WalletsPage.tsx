import * as React from 'react';
import { Route, Routes } from 'react-router-dom';
import { ConnectionsWrapper } from './Connections/ConnectionWrapper';
import { ContactsWrapper } from './Contacts/ContactsWrapper';
import { Navigation } from './Navigation';
import DeveloperSettings from './Settings/DeveloperSettings';
import GeneralSettings from './Settings/GeneralSettings';
import NetworkSettings from './Settings/NetworkSettings';
import { SettingsWrapper } from './Settings/SettingsWrapper';
import SendDetail from './Wallets/SendDetail/SendDetail';
import { WalletDetail } from './Wallets/WalletDetail';
import { WalletsWrapper } from './Wallets/WalletWrapper';

interface IRoutes {
  name: string;
  path: string;
  summaryComponent: React.ReactElement;
  detailComponent: React.ReactElement;
}

const routes: IRoutes[] = [
  {
    name: 'wallets',
    path: '/wallets',
    summaryComponent: <WalletsWrapper />,
    detailComponent: <WalletDetail />,
  },
  {
    name: 'send asset',
    path: '/wallets/send',
    summaryComponent: <WalletsWrapper />,
    detailComponent: <SendDetail />,
  },
  {
    name: 'connections',
    path: '/connections',
    summaryComponent: <ConnectionsWrapper />,
    detailComponent: <div>connections detail</div>,
  },
  {
    name: 'contacts',
    path: '/contacts',
    summaryComponent: <ContactsWrapper />,
    detailComponent: <div>contacts detail</div>,
  },
  {
    name: 'general settings',
    path: '/settings/general',
    summaryComponent: <SettingsWrapper />,
    detailComponent: <GeneralSettings />,
  },
  {
    name: 'network settings',
    path: '/settings/network',
    summaryComponent: <SettingsWrapper />,
    detailComponent: <NetworkSettings />,
  },
  {
    name: 'security settings',
    path: '/settings/security',
    summaryComponent: <SettingsWrapper />,
    detailComponent: <div>security settings detail</div>,
  },
  {
    name: 'developer settings',
    path: '/settings/developer',
    summaryComponent: <SettingsWrapper />,
    detailComponent: <DeveloperSettings />,
  },
];

export const WalletsPage: React.FunctionComponent = () => (
  <div className="flex h-screen">
    {/* Navigation */}
    <Navigation />

    <div className="flex-grow flex">
      {/* summary pane */}
      <div
        className={[
          'w-1/3',
          'bg-grey-100',
          'border-x',
          'border-grey-300',
          'p-8',
          'overflow-y-scroll',
        ].join(' ')}
      >
        <Routes>
          {routes.map((item) => (
            <Route
              index={item.path === '/'}
              key={item.name}
              path={item.path}
              element={item.summaryComponent}
            />
          ))}
        </Routes>
      </div>

      {/* details pane */}
      <div className="w-2/3 p-8 overflow-y-scroll">
        <Routes>
          {routes.map((item) => (
            <Route
              key={item.name}
              path={item.path}
              element={item.detailComponent}
            />
          ))}
        </Routes>
      </div>
    </div>
  </div>
);
