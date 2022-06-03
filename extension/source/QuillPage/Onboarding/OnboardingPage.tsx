import { FunctionComponent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QuillContext from '../QuillContext';

import OnboardingActionPanel from './OnboardingActionPanel';
import OnboardingInfoPanel from './OnboardingInfoPanel';

const OnboardingPage: FunctionComponent = () => {
  const quillCtx = QuillContext.use();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const onboardingComplete =
        await quillCtx.rpc.private.quill_isOnboardingComplete();

      if (onboardingComplete) {
        navigate('/wallet/');
      }
    })();
  }, [navigate, quillCtx]);

  return (
    <div className="flex h-screen">
      <OnboardingInfoPanel />
      <OnboardingActionPanel />
    </div>
  );
};

export default OnboardingPage;
