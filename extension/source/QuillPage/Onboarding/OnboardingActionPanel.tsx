import { FunctionComponent } from 'react';

import PasswordCreationPanel from './PasswordCreationPanel';
import SecretPhrasePanel from './SecretPhrasePanel';
import SetNicknamePanel from './SetNicknamePanel';
import WorkflowNumbers from './WorkflowNumbers';

const OnboardingActionPanel: FunctionComponent<{ pageIndex: number }> = ({
  pageIndex,
}) => (
  <div className="h-screen p-32 flex flex-col flex-grow space-y-16 items-center">
    <WorkflowNumbers current={pageIndex + 1} max={3} />
    <div className="w-96">
      {
        [
          <PasswordCreationPanel
            key={1}
            onComplete={() => {
              window.location.href = `?p=2`;
            }}
          />,
          <SetNicknamePanel
            key={2}
            onComplete={() => {
              window.location.href = `?p=3`;
            }}
          />,
          <SecretPhrasePanel
            key={3}
            onComplete={() => {
              window.location.href = `?p=1`;
            }}
          />,
        ][pageIndex]
      }
    </div>
  </div>
);

export default OnboardingActionPanel;
