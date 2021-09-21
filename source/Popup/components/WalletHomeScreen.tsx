import { BigNumber } from 'ethers';
import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import UiEvents from '../UiEvents';
import Button from './Button';

import CompactQuillHeading from './CompactQuillHeading';
import CopyIcon from './CopyIcon';
import Grow from './Grow';
import NotImplemented from './NotImplemented';

export type BlsKey = {
  public: string;
  private: string;
};

const WalletHomeScreen = (props: {
  uie: UiEvents;
  blsKey: BlsKey;
  wallet?: { address: string; balance: string; nonce: string };
}): React.ReactElement => (
  <div className="wallet-home-screen">
    <div className="section">
      <CompactQuillHeading />
    </div>
    <div className="section">
      <div className="field-list">
        <BLSKeyField uie={props.uie} blsKey={props.blsKey} />
        <NetworkField />
        {(() => {
          if (!props.wallet) {
            return (
              <>
                <div />
                <Button highlight={true} onPress={() => {}}>
                  Create BLS Wallet
                </Button>
              </>
            );
          }

          return (
            <AddressField
              uie={props.uie}
              address={props.wallet.address}
              nonce={props.wallet.nonce}
            />
          );
        })()}
      </div>
    </div>
    <WalletContent uie={props.uie} wallet={props.wallet} />
  </div>
);

export default WalletHomeScreen;

const BLSKeyField = (props: {
  uie: UiEvents;
  blsKey: BlsKey;
}): React.ReactElement => (
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
        navigator.clipboard.writeText(props.blsKey.public);
        props.uie.emit('notification', 'BLS public key copied to clipboard');
      })}
    >
      <div className="grow">{formatCompactAddress(props.blsKey.public)}</div>
      <CopyIcon />
    </div>
    <div className="field-trailer">
      <KeyIcon
        src={browser.runtime.getURL('assets/download.svg')}
        text="Backup private key"
        onAction={() => NotImplemented(props.uie)}
      />
      <KeyIcon
        src={browser.runtime.getURL('assets/trashcan.svg')}
        text="Delete BLS key"
        onAction={() =>
          props.uie.emit('overlay', (close) => (
            <DeleteKeyPrompt close={close} />
          ))
        }
      />
    </div>
  </div>
);

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
      <option>Optimism</option>
      <option>Arbitrum</option>
    </select>
    <div className="field-trailer" />
  </div>
);

const AddressField = (props: {
  uie: UiEvents;
  address: string;
  nonce: string;
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
        props.uie.emit('notification', 'Address copied to clipboard');
      })}
    >
      <div className="grow">{formatCompactAddress(props.address)}</div>
      <CopyIcon />
    </div>
    <div className="field-trailer">#{props.nonce}</div>
  </div>
);

const WalletContent = (props: {
  uie: UiEvents;
  wallet?: { address: string; balance: string };
}): React.ReactElement => {
  if (!props.wallet) {
    return <></>;
  }

  return (
    <div className="section wallet-content">
      <div className="balance">
        <div className="label">Balance:</div>
        <div className="value">
          {formatBalance(props.wallet.balance, 'ETH')}
        </div>
      </div>
      <Button highlight={true} onPress={() => NotImplemented(props.uie)}>
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

const DeleteKeyPrompt = (props: { close: () => void }): React.ReactElement => (
  <div className="delete-key-prompt">
    <div>
      Are you sure that you want to delete this key? You can only restore your
      wallet if you have backed up your private key.
    </div>
    <div />
    <Button highlight={true} onPress={() => {}}>
      Delete BLS key
    </Button>
    <Button onPress={props.close}>Cancel</Button>
  </div>
);

function formatBalance(balance: string | undefined, currency: string): string {
  if (balance === undefined) {
    return '';
  }

  const microBalance = BigNumber.from(balance).div(BigNumber.from(10).pow(12));

  return `${(microBalance.toNumber() / 1000000).toFixed(3)} ${currency}`;
}

function formatCompactAddress(address: string): string {
  return `0x ${address.slice(2, 6)} ... ${address.slice(-4)}`;
}

function defineAction(handler: () => void) {
  return {
    onClick: handler,
    onKeyDown: (evt: { code: string }) => {
      if (evt.code === 'Enter') {
        handler();
      }
    },
  };
}
