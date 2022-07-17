import React, { FunctionComponent } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';

import OnboardingPage from './Onboarding/OnboardingPage';
import { WalletsPage } from './Wallet/WalletsPage';
import { QuillContextProvider } from '../QuillContext';
import Theme from './Theme';
import LoadingPage from './LoadingPage';

const Home: FunctionComponent = () => {
  return (
    <QuillContextProvider>
      <Theme>
        <HashRouter>
          <Routes>
            <Route path="/" element={<LoadingPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/*" element={<WalletsPage />} />
          </Routes>
        </HashRouter>
      </Theme>
    </QuillContextProvider>
  );
};

export default Home;
