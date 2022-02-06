import * as React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Navigation } from './Navigation';

export const WalletPage: React.FunctionComponent = () => {
  return (
    <div className="flex h-screen">
      <HashRouter>
        <Navigation />

        <Routes>
          <Route path="/" element={<div>Wallets</div>} />
          <Route path="/connections" element={<div>connections</div>} />
          <Route path="/contacts" element={<div>contacts</div>} />
          <Route path="/settings" element={<div>settings</div>} />
        </Routes>
      </HashRouter>
    </div>
  );
};
