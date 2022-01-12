import * as React from 'react';

import PasswordCreationPanel from './PasswordCreationPanel';
import QuickColumn from './QuickColumn';
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
        // TODO
      ][pageIndex]
    }
  </QuickColumn>
);

export default OnboardingActionPanel;
