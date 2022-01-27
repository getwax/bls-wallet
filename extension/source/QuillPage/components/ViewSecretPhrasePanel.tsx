import * as React from 'react';
import { ArrowRight, Eye, EyeClosed } from 'phosphor-react';

import Button from '../../components/Button';
import Range from '../../helpers/Range';
import QuickColumn from './QuickColumn';
import QuickRow from './QuickRow';

const ViewSecretPhrasePanel: React.FunctionComponent<{
  secretPhrase: string[];
  onComplete: () => void;
}> = ({ secretPhrase, onComplete }) => {
  const [expanded, setExpanded] = React.useState(false);

  const classes = ['view-secret-phrase-panel'];

  if (expanded) {
    classes.push('expanded');
  }

  return (
    <div className="view-secret-phrase-panel">
      <div className="instructions-text">
        <h3>
          Congratulations!
          <br />
          You have created a wallet.
        </h3>
        <p>
          Below is your secret recovery phrase, which you will need when
          restoring your wallets should you lose access.
        </p>
      </div>
      {expanded && (
        <div className="secret-phrase-box">
          {Range(4).map((i) => (
            <QuickRow key={`row${i}`}>
              {Range(3).map((j) => (
                <QuickColumn key={`column${j}`}>
                  {3 * i + j + 1}. {secretPhrase[3 * i + j]}
                </QuickColumn>
              ))}
            </QuickRow>
          ))}
        </div>
      )}
      <div style={{ display: 'inline-block' }}>
        <Button
          onPress={() => setExpanded(!expanded)}
          className="btn-secondary"
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
            className="btn-primary"
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
