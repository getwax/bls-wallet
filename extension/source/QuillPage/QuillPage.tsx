import { FunctionComponent } from 'react';

import OnboardingPage from './components/OnboardingPage';
import { WalletPage } from './Wallet/WalletPage';

// Note: This is for demo purposes only while building the ui. This is not how
// navigation will work.
const pageNumber = Number(
  new URL(window.location.href).searchParams.get('p') ?? '1',
);

const onboardingComplete = true;

const QuillPage: FunctionComponent = () => {
  if (!onboardingComplete) {
    return <OnboardingPage pageIndex={pageNumber - 1} />;
  }

  return <WalletPage />;
};

export default QuillPage;
