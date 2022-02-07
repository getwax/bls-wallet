import * as React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ConnectionsWrapper } from './Connections/ConnectionWrapper';
import { ContactsWrapper } from './Contacts/ContactsWrapper';
import { Navigation } from './Navigation';
import { WalletsWrapper } from './Wallets/WalletWrapper';

interface IRoutes {
  name: string;
  path: string;
  summaryComponent: JSX.Element;
  detailComponent: JSX.Element;
}

const routes: IRoutes[] = [
  {
    name: 'wallets',
    path: '/',
    summaryComponent: <WalletsWrapper />,
    detailComponent: <div>Wallets Detail</div>,
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
    name: 'settings',
    path: '/settings',
    summaryComponent: <div>settings summary</div>,
    detailComponent: <div>settings detail</div>,
  },
];

export const WalletPage: React.FunctionComponent = () => {
  return (
    <div className="flex h-screen">
      <HashRouter>
        {/* Navigation */}
        <Navigation />

        <div className="flex-grow flex">
          {/* summary pane */}
          <div className="w-1/3 bg-grey-100 border-x border-grey-300 p-8 overflow-y-scroll">
            <Routes>
              {routes.map((item) => (
                <Route
                  key={item.name}
                  path={item.path}
                  element={item.summaryComponent}
                />
              ))}
            </Routes>
          </div>

          {/* details pane */}
          <div className="w-2/3 p-8">
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
      </HashRouter>
    </div>
  );
};
