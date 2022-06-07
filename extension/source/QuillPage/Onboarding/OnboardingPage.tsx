import { FunctionComponent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuill } from '../QuillContext';

import OnboardingActionPanel from './OnboardingActionPanel';
import OnboardingInfoPanel from './OnboardingInfoPanel';

const OnboardingPage: FunctionComponent = () => {
  const { rpc } = useQuill();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const onboardingComplete = await rpc.private.quill_isOnboardingComplete();

      if (onboardingComplete) {
        navigate('/wallet/');
      }
    })();
  }, [navigate, rpc]);

  return (
    <div className="flex h-screen">
      <OnboardingInfoPanel />
      <OnboardingActionPanel />
    </div>
  );
};

export default OnboardingPage;
