import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
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
    <div className={classes.join(' ')}>
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
      <div className="show-box">
        <div style={{ display: 'inline-block' }}>
          <Button
            onPress={() => setExpanded(true)}
            highlight={false}
            icon={{
              src: browser.runtime.getURL('assets/eye.svg'),
              px: 19,
            }}
          >
            Show secret phrase
          </Button>
        </div>
      </div>
      <div className="hide-box">
        <QuickRow>
          <Button onPress={() => setExpanded(false)} highlight={false}>
            Hide secret phrase
          </Button>
          <Button
            onPress={onComplete}
            highlight={true}
            icon={{
              src: browser.runtime.getURL('assets/arrow-small.svg'),
              px: 19,
            }}
          >
            Review secret phrase
          </Button>
        </QuickRow>
      </div>
    </div>
  );
};

export default ViewSecretPhrasePanel;
