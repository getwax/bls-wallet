import { FunctionComponent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import OnboardingActionPanel from './OnboardingActionPanel';
import OnboardingInfoPanel from './OnboardingInfoPanel';

const OnboardingPage: FunctionComponent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const onboardingComplete = window
      .KeyringController()
      .isOnboardingComplete();

    if (onboardingComplete) {
      navigate('/wallet/');
    }
  }, [navigate]);

  return (
    <div className="flex h-screen">
      <OnboardingInfoPanel />
      <OnboardingActionPanel />
    </div>
  );
};

export default OnboardingPage;
