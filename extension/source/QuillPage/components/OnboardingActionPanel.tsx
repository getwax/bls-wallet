import * as React from 'react';

import PasswordCreationPanel from './PasswordCreationPanel';
import QuickColumn from './QuickColumn';
import SetNicknamePanel from './SetNicknamePanel';
import ViewSecretPhrasePanel from './ViewSecretPhrasePanel';
import WorkflowNumbers from './WorkflowNumbers';

const OnboardingActionPanel: React.FunctionComponent<{ pageIndex: number }> = ({
  pageIndex,
}) => (
  <QuickColumn>
    <WorkflowNumbers current={pageIndex + 1} max={3} />
    {
      [
        <PasswordCreationPanel key={1} />,
        <SetNicknamePanel key={2} />,
        <ViewSecretPhrasePanel key={3} />,
      ][pageIndex]
    }
  </QuickColumn>
);

export default OnboardingActionPanel;
