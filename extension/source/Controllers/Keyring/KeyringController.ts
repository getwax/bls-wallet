import { Wallet } from 'ethers';
import BaseController from '../BaseController';
import { BaseConfig } from '../interfaces';
import {
  IKeyringController,
  KeyringControllerState,
} from './IKeyringController';

export default class KeyringController
  extends BaseController<BaseConfig, KeyringControllerState>
  implements IKeyringController
{
  name = 'KeyringController';

  constructor({
    config = {},
    state,
  }: {
    config: BaseConfig;
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

  getPublicKeys(): string[] {
    return this.state.wallets.map((x) => x.publicKey);
  }

  getPublicKeyFromAddress(address: string): string {
    const keyPair = this.state.wallets.find((x) => x.address === address);
    if (!keyPair) throw new Error('key does not exist');
    return keyPair.publicKey;
  }

  importAccount(privateKey: string): string {
    const existingWallet = this.state.wallets.find(
      (x) => x.privateKey.toLowerCase() === privateKey.toLowerCase(),
    );
    if (existingWallet) return existingWallet.address;
    const wallet = new Wallet(privateKey);
    this.update({
      wallets: [
        ...this.state.wallets,
        {
          publicKey: wallet.publicKey,
          privateKey,
          address: wallet.address,
        },
      ],
    });
    return wallet.address;
  }

  removeAccount(address: string): void {
    const existingWallets = [...this.state.wallets];
    const index = this.state.wallets.findIndex((x) => x.address === address);
    if (index !== -1) {
      existingWallets.splice(index, 1);
      this.update({ wallets: existingWallets });
    }
  }

  // TODO: add methods to sign transactions / messages
}
