import * as React from "react";

import PasswordCreationPanel from "./PasswordCreationPanel";
import SecretPhrasePanel from "./SecretPhrasePanel";
import SetNicknamePanel from "./SetNicknamePanel";
import WorkflowNumbers from "./WorkflowNumbers";

const OnboardingActionPanel: React.FunctionComponent<{ pageIndex: number }> = ({
  pageIndex,
}) => (
  <div className="flex flex-col flex-grow">
    <WorkflowNumbers current={pageIndex + 1} max={3} />
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
);

export default OnboardingActionPanel;
