import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import Button from '../../components/Button';

const PasswordCreationPanel: React.FunctionComponent<{
  onComplete: () => void;
}> = ({ onComplete }) => (
  <>
    <div className="instructions-text">
      <h3>It&apos;s time to create your first wallet!</h3>
      <p>
        Let&apos;s give it a nickname so that you can easily identify it when
        you have more wallets.
      </p>
    </div>
    <div>
      <input type="text" placeholder="Nickname" />
    </div>
    <div className="explainer-box">
      Setting a nickname is optional but recommended.
    </div>
    <div>
      <div style={{ display: 'inline-block' }}>
        <Button
          onPress={onComplete}
          highlight={true}
          icon={{
            src: browser.runtime.getURL('assets/arrow-small.svg'),
            px: 19,
          }}
        >
          Create wallet
        </Button>
      </div>
    </div>
  </>
);

export default PasswordCreationPanel;
