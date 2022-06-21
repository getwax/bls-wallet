import { FunctionComponent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import PasswordCreationPanel from './PasswordCreationPanel';
import SecretPhrasePanel from './SecretPhrasePanel';
import SetNicknamePanel from './SetNicknamePanel';
import WorkflowNumbers from './WorkflowNumbers';

const OnboardingActionPanel: FunctionComponent = () => {
  const [params, setParams] = useSearchParams();
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    const p = params.get('p');

    if (p !== null) {
      setPageIndex(Number(p) - 1);
    }
  }, [params]);

  return (
    <div className="h-screen p-32 flex flex-col flex-grow space-y-16 items-center">
      <WorkflowNumbers max={3} />
      <div className="w-96">
        {
          [
            <PasswordCreationPanel
              key={1}
              onComplete={() => {
                setParams({ p: '2' });
              }}
            />,
            <SetNicknamePanel
              key={2}
              onComplete={() => {
                setParams({ p: '3' });
              }}
            />,
            <SecretPhrasePanel key={3} />,
          ][pageIndex]
        }
      </div>
    </div>
  );
};

export default OnboardingActionPanel;
