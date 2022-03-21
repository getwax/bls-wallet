import { FunctionComponent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import OnboardingActionPanel from './OnboardingActionPanel';
import OnboardingInfoPanel from './OnboardingInfoPanel';

const onboardingComplete = false;

const OnboardingPage: FunctionComponent = () => {
  let navigate = useNavigate();

  useEffect(() => {
    // TODO - add loading state to prevent
    // DOM loading if onboarding complete
    if (onboardingComplete) {
      navigate('/wallet/');
    }
  }, [onboardingComplete]);

  return (
    <div className="flex h-screen">
      <OnboardingInfoPanel />
      <OnboardingActionPanel />
    </div>
  );
};

export default OnboardingPage;
