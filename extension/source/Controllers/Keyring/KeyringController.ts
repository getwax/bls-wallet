import { BlsWalletWrapper, Operation } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import generateRandomHex from '../../helpers/generateRandomHex';
import { IKeyringController } from './IKeyringController';
import { DEFAULT_CHAIN_ID_HEX, NETWORK_CONFIG } from '../../env';
import { getRPCURL } from '../utils';
import QuillCells from '../../QuillCells';

export default class KeyringController implements IKeyringController {
  name = 'KeyringController';

  constructor(public state: QuillCells['keyring']) {}

  async getAccounts(): Promise<string[]> {
    return (await this.state.read()).wallets.map((x) => x.address);
  }

  async setHDPhrase(phrase: string) {
    const state = await this.state.read();
    state.HDPhrase = phrase;
    await this.state.write(state);
  }

  async requireHDPhrase() {
    const state = await this.state.read();
    let phrase = state.HDPhrase;

    if (phrase === undefined) {
      phrase = ethers.Wallet.createRandom().mnemonic.phrase;
      state.HDPhrase = phrase;
      await this.state.write(state);
    }

    return phrase;
  }

  async isOnboardingComplete(): Promise<boolean> {
    return (await this.state.read()).HDPhrase !== undefined;
  }

  async createHDAccount(): Promise<string> {
    const mnemonic = await this.requireHDPhrase();
    const node = ethers.utils.HDNode.fromMnemonic(mnemonic);

    const partialPath = "m/44'/60'/0'/0/";
    const path = partialPath + (await this.state.read()).wallets.length;

    const { privateKey } = node.derivePath(path);
    return this._createAccountAndUpdate(privateKey);
  }

  async createAccount(): Promise<string> {
    const privateKey = generateRandomHex(256);
    return this._createAccountAndUpdate(privateKey);
  }

  async importAccount(privateKey: string): Promise<string> {
    const existingWallet = (await this.state.read()).wallets.find(
      (x) => x.privateKey.toLowerCase() === privateKey.toLowerCase(),
    );
    if (existingWallet) return existingWallet.address;

    return this._createAccountAndUpdate(privateKey);
  }

  async removeAccount(address: string) {
    const state = await this.state.read();
    const index = state.wallets.findIndex((x) => x.address === address);
    if (index !== -1) {
      state.wallets.splice(index, 1);
      await this.state.write(state);
    }
  }

  async signTransactions(address: string, tx: Operation) {
    const privKey = await this._getPrivateKeyFor(address);
    const wallet = await this._getBLSWallet(privKey);

    return wallet.sign(tx);
  }

  async getNonce(address: string) {
    const privKey = await this._getPrivateKeyFor(address);
    const wallet = await this._getBLSWallet(privKey);
    return wallet.Nonce();
  }

  async _createAccountAndUpdate(privateKey: string): Promise<string> {
    const address = await this._getContractWalletAddress(privateKey);

    if (address) {
      const state = await this.state.read();
      state.wallets.push({ privateKey, address });
      await this.state.write(state);
    }

    return address;
  }

  private async _getPrivateKeyFor(address: string): Promise<string> {
    const checksummedAddress = ethers.utils.getAddress(address);
    const keyPair = (await this.state.read()).wallets.find(
      (x) => x.address === checksummedAddress,
    );
    if (!keyPair) throw new Error('key does not exist');
    return keyPair.privateKey;
  }

  private async _createProvider(): Promise<ethers.providers.Provider> {
    const { chainId } = await this.state.read();

    return new ethers.providers.JsonRpcProvider(
      // FIXME: We should always have a chain id, but properly tracking this is
      // not yet set up
      getRPCURL(chainId ?? DEFAULT_CHAIN_ID_HEX),
    );
  }

  private async _getContractWalletAddress(privateKey: string): Promise<string> {
    return BlsWalletWrapper.Address(
      privateKey,
      NETWORK_CONFIG.addresses.verificationGateway,
      await this._createProvider(),
    );
  }

  private async _getBLSWallet(privateKey: string): Promise<BlsWalletWrapper> {
    return BlsWalletWrapper.connect(
      privateKey,
      NETWORK_CONFIG.addresses.verificationGateway,
      await this._createProvider(),
    );
  }
}
