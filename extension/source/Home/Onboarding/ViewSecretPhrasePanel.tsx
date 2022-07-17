import { FunctionComponent, useState } from 'react';
import { ArrowRight, Eye, EyeClosed } from 'phosphor-react';

import Button from '../../components/Button';
import Range from '../../helpers/Range';

const ViewSecretPhrasePanel: FunctionComponent<{
  secretPhrase: string[];
  onComplete: () => void;
}> = ({ secretPhrase, onComplete }) => {
  const [expanded, setExpanded] = useState(false);

  const classes = ['view-secret-phrase-panel'];

  if (expanded) {
    classes.push('expanded');
  }

  return (
    <div className="w-[28rem]">
      <div className="mb-10">
        <div className="font-bold">
          Congratulations!
          <br />
          You have created a wallet.
        </div>
        <span>
          Below is your secret recovery phrase, which you will need when
          restoring your wallets should you lose access.
        </span>
      </div>
      {expanded && (
        <div>
          {Range(4).map((i) => (
            <div
              className="flex justify-between text-left gap-2"
              key={`row${i}`}
            >
              {Range(3).map((j) => (
                <div
                  className={[
                    'bg-grey-200 w-1/3 mb-2 py-2 px-4 rounded-md',
                    'hover:bg-grey-300',
                  ].join(' ')}
                  key={`column${j}`}
                >
                  {3 * i + j + 1}. {secretPhrase[3 * i + j]}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-6">
        <Button
          onPress={() => setExpanded(!expanded)}
          className="btn-secondary w-1/2"
          icon={
            !expanded ? (
              <Eye className="icon-md" />
            ) : (
              <EyeClosed className="icon-md" />
            )
          }
        >
          {!expanded ? 'Show secret phrase' : 'Hide secret phrase'}
        </Button>
        {expanded && (
          <Button
            onPress={onComplete}
            className="btn-primary w-1/2"
            icon={<ArrowRight className="icon-md" />}
          >
            Review secret phrase
          </Button>
        )}
      </div>
    </div>
  );
};

export default ViewSecretPhrasePanel;
