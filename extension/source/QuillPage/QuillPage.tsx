import React, { FunctionComponent } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';

import OnboardingPage from './Onboarding/OnboardingPage';
import { WalletPage } from './Wallet/WalletPage';
import { QuillProvider } from './QuillContext';

const QuillPage: FunctionComponent = () => {
  return (
    <QuillProvider>
      <HashRouter>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/wallet/*" element={<WalletPage />} />
        </Routes>
      </HashRouter>
    </QuillProvider>
  );
};

export default QuillPage;
