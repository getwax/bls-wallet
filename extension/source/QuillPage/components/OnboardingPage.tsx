import * as React from 'react';

import OnboardingActionPanel from './OnboardingActionPanel';
import OnboardingInfoPanel from './OnboardingInfoPanel';

const OnboardingPage: React.FunctionComponent<{ pageIndex: number }> = ({
  pageIndex,
}) => (
  <div className="onboarding-page quick-row" style={{ height: '100vh' }}>
    <OnboardingInfoPanel pageIndex={pageIndex} />
    <OnboardingActionPanel pageIndex={pageIndex} />
  </div>
);

export default OnboardingPage;
