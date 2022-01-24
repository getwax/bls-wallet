import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';

import { CREATE_TX_URL } from '../../env';
import assertExists from '../../helpers/assertExists';
import defineAction from '../../helpers/defineAction';
import App from '../../App';
import formatBalance from '../helpers/formatBalance';
import formatCompactAddress from '../helpers/formatCompactAddress';
import Button from '../../components/Button';
import CompactQuillHeading from '../../components/CompactQuillHeading';
import CopyIcon from './CopyIcon';
import Grow from './Grow';

export type BlsKey = {
  public: string;
  private: string;
};

type Props = {
  app: App;
};

const WalletHomeScreen = ({ app }: Props): React.ReactElement => (
  <div className="wallet-home-screen">
    <div className="section">
      <CompactQuillHeading />
    </div>
    <div className="section">
      <div className="field-list">
        <BLSKeyField app={app} />
        <NetworkField />
        {(() => {
          const { walletAddress, walletState } = app.state;
          if (walletAddress.loadCounter > 0 || !walletAddress.value) {
            return (
              <>
                <div />
                <Button
                  className="btn-primary"
                  onPress={() => {
                    /* no-op */
                  }}
                  loading={true}
                >
                  Loading...
                </Button>
              </>
            );
          }

          return (
            <AddressField
              app={app}
              address={walletAddress.value}
              nonce={walletState.nonce}
            />
          );
        })()}
      </div>
    </div>
    <WalletContent app={app} />
  </div>
);

export default WalletHomeScreen;

const BLSKeyField = ({ app }: Props): React.ReactElement | null => {
  const publicKey = app.PublicKey();
  if (!publicKey) {
    return null;
  }

  return (
    <div>
      <div style={{ width: '17px' }}>
        <img
          src={browser.runtime.getURL('assets/key.svg')}
          alt="key"
          width="14"
          height="15"
        />
      </div>
      <div className="field-label">BLS Key:</div>
      <div
        className="field-value grow"
        {...defineAction(() => {
          navigator.clipboard.writeText(publicKey);
          app.pageEvents.emit(
            'notification',
            'info',
            'BLS public key copied to clipboard',
          );
        })}
      >
        <div className="grow">{formatCompactAddress(publicKey)}</div>
        <CopyIcon />
      </div>
      <div className="field-trailer">
        <KeyIcon
          src={browser.runtime.getURL('assets/download.svg')}
          text="Backup private key"
          onAction={() =>
            app.pageEvents.emit('overlay', (close) => (
              <CopyPrivateKeyPrompt app={app} close={close} />
            ))
          }
        />
        <KeyIcon
          src={browser.runtime.getURL('assets/trashcan.svg')}
          text="Delete BLS key"
          onAction={() =>
            app.pageEvents.emit('overlay', (close) => (
              <DeleteKeyPrompt app={app} close={close} />
            ))
          }
        />
      </div>
    </div>
  );
};

const NetworkField = (): React.ReactElement => (
  <div>
    <div style={{ width: '17px' }}>
      <img
        src={browser.runtime.getURL('assets/network.svg')}
        alt="network"
        width="14"
        height="15"
      />
    </div>
    <div className="field-label">Network:</div>
    <select
      className="field-value grow"
      style={{
        backgroundImage: `url("${browser.runtime.getURL(
          'assets/selector-down-arrow.svg',
        )}")`,
      }}
    >
      <option>Arbitrum</option>
      <option disabled>Optimism</option>
    </select>
    <div className="field-trailer" />
  </div>
);

const AddressField = (props: {
  app: App;
  address: string;
  nonce?: string;
}): React.ReactElement => (
  <div>
    <div style={{ width: '17px' }}>
      <img
        src={browser.runtime.getURL('assets/address.svg')}
        alt="address"
        width="14"
        height="15"
      />
    </div>
    <div className="field-label">Address:</div>
    <div
      className="field-value grow"
      {...defineAction(() => {
        navigator.clipboard.writeText(props.address);
        props.app.pageEvents.emit(
          'notification',
          'info',
          'Address copied to clipboard',
        );
      })}
    >
      <div className="grow">{formatCompactAddress(props.address)}</div>
      <CopyIcon />
    </div>
    <div className="field-trailer">#{props.nonce}</div>
  </div>
);

const WalletContent = ({ app }: Props): React.ReactElement => {
  if (!app.state.walletAddress.value) {
    return <></>;
  }

  return (
    <div className="section wallet-content">
      <div className="balance">
        <div className="label">Balance:</div>
        <div className="value">
          {formatBalance(app.state.walletState.balance, 'ETH')}
        </div>
      </div>
      <Button
        className="btn-primary"
        onPress={() => {
          browser.tabs.create({
            url: CREATE_TX_URL || 'createTransaction.html',
          });
        }}
      >
        Create Transaction
      </Button>
    </div>
  );
};

const KeyIcon = (props: {
  src: string;
  text: string;
  onAction: () => void;
}): React.ReactElement => (
  <div className="key-icon" style={{ width: '22px', height: '22px' }}>
    <img
      src={props.src}
      alt={props.text}
      width="22"
      height="22"
      {...defineAction(props.onAction)}
    />
    <div className="info-box">
      <Grow />
      <div className="content">{props.text}</div>
    </div>
    <div className="info-arrow" />
  </div>
);

const DeleteKeyPrompt = (props: {
  app: App;
  close: () => void;
}): React.ReactElement => (
  <div className="delete-key-prompt">
    <div>
      Are you sure that you want to delete this key? You can only restore your
      wallet if you have backed up your private key.
    </div>
    <div />
    <Button
      className="btn-primary"
      onPress={() => {
        props.app.deletePrivateKey();
        props.close();
      }}
    >
      Delete BLS key
    </Button>
    <Button className="btn-secondary" onPress={props.close}>
      Cancel
    </Button>
  </div>
);

const CopyPrivateKeyPrompt = (props: {
  app: App;
  close: () => void;
}): React.ReactElement => (
  <div className="delete-key-prompt">
    <div>
      You should make sure you store your private key somewhere safe. If you
      lose it, you won’t be able to restore your wallet.
    </div>
    <div />
    <Button
      className="btn-primary"
      onPress={() => {
        navigator.clipboard.writeText(assertExists(props.app.state.privateKey));
        props.close();
        props.app.pageEvents.emit(
          'notification',
          'info',
          'BLS private key copied to clipboard',
        );
      }}
    >
      Copy private key
    </Button>
    <Button className="btn-secondary" onPress={props.close}>
      Cancel
    </Button>
  </div>
);
