import * as React from 'react';

import PasswordCreationPanel from './PasswordCreationPanel';
import QuickColumn from './QuickColumn';
import SecretPhrasePanel from './SecretPhrasePanel';
import SetNicknamePanel from './SetNicknamePanel';
import WorkflowNumbers from './WorkflowNumbers';

const OnboardingActionPanel: React.FunctionComponent<{ pageIndex: number }> = ({
  pageIndex,
}) => (
  <QuickColumn>
    <WorkflowNumbers
      current={pageIndex + 1}
      max={3}
      onSelect={(workflowNumber) => {
        window.location.href = `?p=${workflowNumber}`;
      }}
    />
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
  </QuickColumn>
);

export default OnboardingActionPanel;
