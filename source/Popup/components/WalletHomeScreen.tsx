import { BigNumber } from 'ethers';
import * as React from 'react';
import { browser } from 'webextension-polyfill-ts';
import Button from './Button';

import CompactQuillHeading from './CompactQuillHeading';
import CopyIcon from './CopyIcon';
import Grow from './Grow';

export type BlsKey = {
  public: string;
  private: string;
};

const WalletHomeScreen = (props: {
  blsKey: BlsKey;
  wallet?: { address: string; balance: string; nonce: string };
}): React.ReactElement => (
  <div className="wallet-home-screen">
    <div className="section">
      <CompactQuillHeading />
    </div>
    <div className="section">
      <div className="field-list">
        <BLSKeyField blsKey={props.blsKey} />
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
              address={props.wallet.address}
              nonce={props.wallet.nonce}
            />
          );
        })()}
      </div>
    </div>
    <WalletContent wallet={props.wallet} />
  </div>
);

export default WalletHomeScreen;

const BLSKeyField = (props: { blsKey: BlsKey }): React.ReactElement => (
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
      {...defineCopyAction(props.blsKey.public)}
    >
      <div className="grow">{formatCompactAddress(props.blsKey.public)}</div>
      <CopyIcon />
    </div>
    <div className="field-trailer">
      <KeyIcon
        src={browser.runtime.getURL('assets/download.svg')}
        text="Backup private key"
      />
      <KeyIcon
        src={browser.runtime.getURL('assets/trashcan.svg')}
        text="Delete BLS key"
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
    <div className="field-value grow" {...defineCopyAction(props.address)}>
      <div className="grow">{formatCompactAddress(props.address)}</div>
      <CopyIcon />
    </div>
    <div className="field-trailer">#{props.nonce}</div>
  </div>
);

const WalletContent = (props: {
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
      <Button highlight={true} onPress={() => {}}>
        Create Transaction
      </Button>
    </div>
  );
};

const KeyIcon = (props: { src: string; text: string }): React.ReactElement => (
  <div className="key-icon" style={{ width: '22px', height: '22px' }}>
    <img src={props.src} alt={props.text} width="22" height="22" />
    <div className="info-box">
      <Grow />
      <div className="content">{props.text}</div>
    </div>
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

function defineCopyAction(value: string) {
  return defineAction(() => navigator.clipboard.writeText(value));
}
