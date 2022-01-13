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
      onSelect={(pageNumber) => {
        // Note: This is for demo purposes only. We're not going to be using
        // search parameters like this.
        window.location.href = `?p=${pageNumber}`;
      }}
    />
    {
      [
        <PasswordCreationPanel key={1} />,
        <SetNicknamePanel key={2} />,
        <SecretPhrasePanel key={3} onComplete={() => {}} />,
      ][pageIndex]
    }
  </QuickColumn>
);

export default OnboardingActionPanel;
