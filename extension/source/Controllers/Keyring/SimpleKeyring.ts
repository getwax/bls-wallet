import { EventEmitter } from 'events';
import { Aggregator, BlsWallet } from 'bls-wallet-clients';
import { initBlsWalletSigner } from 'bls-wallet-signer';
import { providers } from 'ethers';
import generateRandomHex from '../../helpers/generateRandomHex';

import {
  AGGREGATOR_URL,
  CHAIN_ID,
  CHAIN_RPC_URL,
  VERIFICATION_GATEWAY_ADDRESS,
} from '../../env';

const type = 'Simple Key Pair';

type Wallet = {
  privateKey: string;
  publicKey: string;
};
type PrivateKey = string;
type PublicKey = string;
type Options = {
  withAppKeyOrigin?: string;
};

class SimpleKeyring extends EventEmitter {
  public type: string;
  private _wallets: Wallet[];
  private aggregator: Aggregator;
  private provider: providers.Provider;

  constructor(keys?: PrivateKey[]) {
    super();
    this.type = type;
    this._wallets = [];
    this.aggregator = new Aggregator(AGGREGATOR_URL);
    this.provider = new providers.JsonRpcProvider(CHAIN_RPC_URL);
    this.deserialize(keys);
  }

  serialize() {
    return this._wallets.map((wallet) => wallet.privateKey);
  }

  async deserialize(privateKeys: PrivateKey[] = []) {
    const blsWalletSigner = await initBlsWalletSigner({ chainId: CHAIN_ID });

    this._wallets = privateKeys.map((privateKey) => {
      const publicKey = blsWalletSigner.getPublicKey(privateKey);
      return { privateKey, publicKey };
    });
  }

  async addAccounts(n = 1) {
    const blsWalletSigner = await initBlsWalletSigner({ chainId: CHAIN_ID });
    const newWallets: Wallet[] = [];

    for (let i = 0; i < n; i++) {
      const privateKey = generateRandomHex(256);
      const publicKey = blsWalletSigner.getPublicKey(privateKey);

      const creationTx = await BlsWallet.signCreation(
        privateKey,
        VERIFICATION_GATEWAY_ADDRESS,
        this.provider,
      );

      const createResult = await this.aggregator.createWallet(creationTx);

      if (createResult.address === publicKey) {
        newWallets.push({ privateKey, publicKey });
      } else {
        console.error('Create wallet failed', createResult);
      }
    }

    this._wallets = this._wallets.concat(newWallets);
    return this._wallets;
  }

  getAccounts() {
    return this._wallets.map((wallet) => wallet.publicKey);
  }

  exportAccount(address: PublicKey) {
    this._getWalletForAccount(address);
  }

  removeAccount(address: PublicKey) {
    try {
      const wallet = this._wallets.filter(
        (wallet) => wallet.publicKey !== address,
      );
      this._wallets = wallet;
    } catch (error) {
      throw new Error('Simple Keyring - Unable to find matching address.');
    }
  }

  async signTransaction() {}

  async signMessage() {}

  async signPersonalMessage() {}

  async decryptMessage() {}

  async signTypedData() {}

  async getEncryptionPublicKey() {}

  async getAppKeyAddress() {}

  _getPrivateKeyFor(address: PublicKey, opts = {}) {
    if (!address) {
      throw new Error('Must specify address.');
    }
    const wallet = this._getWalletForAccount(address, opts);
    return wallet.privateKey;
  }

  private _getWalletForAccount(account: PublicKey, opts?: Options) {
    const wallet = this._wallets.find(({ publicKey }) => publicKey === account);
    if (!wallet) {
      throw new Error('Simple Keyring - Unable to find matching address.');
    }

    // unused for now, added to make TS happy
    opts?.withAppKeyOrigin;

    return wallet;
  }
}

export default SimpleKeyring;
