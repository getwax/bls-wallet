import React, { FunctionComponent } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';

import OnboardingPage from './Onboarding/OnboardingPage';
import { WalletPage } from './Wallet/WalletPage';
import { QuillContextProvider } from './QuillContext';
import Theme from './Theme';

const QuillPage: FunctionComponent = () => {
  return (
    <QuillContextProvider>
      <Theme>
        <HashRouter>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/wallet/*" element={<WalletPage />} />
          </Routes>
        </HashRouter>
      </Theme>
    </QuillContextProvider>
  );
};

export default QuillPage;
