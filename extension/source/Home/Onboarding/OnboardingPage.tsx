import { FunctionComponent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuill } from '../QuillContext';

import OnboardingActionPanel from './OnboardingActionPanel';
import OnboardingInfoPanel from './OnboardingInfoPanel';

const OnboardingPage: FunctionComponent = () => {
  const { rpc } = useQuill();
  const navigate = useNavigate();

  // TODO: MEGAFIX: Don't show onboarding once completed.

  return (
    <div className="flex h-screen">
      <OnboardingInfoPanel />
      <OnboardingActionPanel />
    </div>
  );
};

export default OnboardingPage;
