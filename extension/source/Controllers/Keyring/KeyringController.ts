import { BlsWalletWrapper, Operation } from 'bls-wallet-clients';
import generateRandomHex from '../../helpers/generateRandomHex';
import BaseController from '../BaseController';
import {
  IKeyringController,
  KeyringControllerConfig,
  KeyringControllerState,
} from './IKeyringController';
import { NETWORK_CONFIG, CHAIN_RPC_URL } from '../../env';
import { ethers } from 'ethers';

export default class KeyringController
  extends BaseController<KeyringControllerConfig, KeyringControllerState>
  implements IKeyringController
{
  name = 'KeyringController';

  constructor({
    config,
    state,
  }: {
    config: Partial<KeyringControllerConfig>;
    state: Partial<KeyringControllerState>;
  }) {
    super({ config, state });
    this.defaultState = {
      wallets: state.wallets ?? [],
    } as KeyringControllerState;
    this.initialize();
  }

  getAccounts(): string[] {
    return this.state.wallets.map((x) => x.address);
  }

  async createAccount(): Promise<string> {
    const privateKey = generateRandomHex(256);
    return this._createAccountAndUpdate(privateKey);
  }

  async importAccount(privateKey: string): Promise<string> {
    const existingWallet = this.state.wallets.find(
      (x) => x.privateKey.toLowerCase() === privateKey.toLowerCase(),
    );
    if (existingWallet) return existingWallet.address;

    return this._createAccountAndUpdate(privateKey);
  }

  removeAccount(address: string): void {
    const existingWallets = [...this.state.wallets];
    const index = this.state.wallets.findIndex((x) => x.address === address);
    if (index !== -1) {
      existingWallets.splice(index, 1);
      this.update({ wallets: existingWallets });
    }
  }

  async signTransactions(address: string, tx: Operation) {
    const privKey = this._getPrivateKeyFor(address);
    const signer = await this._getBLSSinger(privKey);

    return signer.sign(tx);
  }

  async _createAccountAndUpdate(privateKey: string): Promise<string> {
    const address = await this._getContractWalletAddress(privateKey);

    if (address) {
      this.update({
        wallets: [
          ...this.state.wallets,
          {
            privateKey,
            address: address,
          },
        ],
      });
    }

    return address;
  }

  private _getPrivateKeyFor(address: string): string {
    const keyPair = this.state.wallets.find((x) => x.address === address);
    if (!keyPair) throw new Error('key does not exist');
    return keyPair.privateKey;
  }

  private _getContractWalletAddress(privateKey: string) {
    const provider = new ethers.providers.JsonRpcProvider(CHAIN_RPC_URL);
    return BlsWalletWrapper.Address(
      privateKey,
      NETWORK_CONFIG.addresses.verificationGateway,
      provider,
    );
  }

  private async _getBLSSinger(privateKey: string) {
    const provider = new ethers.providers.JsonRpcProvider(CHAIN_RPC_URL);
    return BlsWalletWrapper.connect(
      privateKey,
      NETWORK_CONFIG.addresses.verificationGateway,
      provider,
    );
  }
}
