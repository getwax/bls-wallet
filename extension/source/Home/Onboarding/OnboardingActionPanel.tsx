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
    // TODO (merge-ok) Use hash, deduplicate page detection with other
    // components
    const p = params.get('p');

    if (p !== null) {
      setPageIndex(Number(p) - 1);
    }
  }, [params]);

  return (
    <div
      className={[
        'h-screen',
        'p-4',
        'md:p-8',
        'xl:p-28',
        'flex',
        'flex-col',
        'flex-grow',
        'space-y-16',
        'items-center',
      ].join(' ')}
    >
      <WorkflowNumbers max={3} />
      <div className="w-[24rem] lg:w-[28rem]">
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
