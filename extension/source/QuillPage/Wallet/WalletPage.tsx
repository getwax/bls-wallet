import * as React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Navigation } from './Navigation';

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
    summaryComponent: <div>Wallet Summary</div>,
    detailComponent: <div>Wallets Detail</div>,
  },
  {
    name: 'connections',
    path: '/connections',
    summaryComponent: <div>connections summary</div>,
    detailComponent: <div>connections detail</div>,
  },
  {
    name: 'contacts',
    path: '/contacts',
    summaryComponent: <div>contacts summary</div>,
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
          <div className="w-1/3 bg-grey-100 border-x border-grey-300">
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
          <div className="w-2/3">
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
