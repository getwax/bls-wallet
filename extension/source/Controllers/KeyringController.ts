import { BlsWalletWrapper, Operation } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import generateRandomHex from '../helpers/generateRandomHex';
import { NETWORK_CONFIG } from '../env';
import QuillCells from '../QuillCells';
import assert from '../helpers/assert';
import { IReadableCell } from '../cells/ICell';
import { SafeEventEmitterProvider } from './Network/INetworkController';

export default class KeyringController {
  constructor(
    public state: QuillCells['keyring'],
    public provider: IReadableCell<SafeEventEmitterProvider | undefined>,
  ) {}

  async requireHDPhrase() {
    let { HDPhrase } = await this.state.read();

    if (HDPhrase === undefined) {
      HDPhrase = ethers.Wallet.createRandom().mnemonic.phrase;
      await this.state.update({ HDPhrase });
    }

    return HDPhrase;
  }

  /**
   * Creates a Deterministic Account based on seed phrase
   */
  async createHDAccount(): Promise<string> {
    const mnemonic = await this.requireHDPhrase();
    const node = ethers.utils.HDNode.fromMnemonic(mnemonic);

    const newAccountIndex = (await this.state.read()).wallets.length;
    const { privateKey } = node.derivePath(`m/44'/60'/0'/0/${newAccountIndex}`);

    return this._createAccountAndUpdate(privateKey);
  }

  /**
   * Creates a new key pair
   */
  async createAccount(): Promise<string> {
    const privateKey = generateRandomHex(256);
    return this._createAccountAndUpdate(privateKey);
  }

  /**
   * Imports a key pair
   * @param privateKey - Hex string without 0x prefix
   */
  async importAccount(privateKey: string): Promise<string> {
    const existingWallet = (await this.state.read()).wallets.find(
      (x) => x.privateKey.toLowerCase() === privateKey.toLowerCase(),
    );
    if (existingWallet) return existingWallet.address;

    return this._createAccountAndUpdate(privateKey);
  }

  /**
   * Removes a key pair
   * @param address - Address of the key pair
   */
  async removeAccount(address: string) {
    const state = await this.state.read();
    const index = state.wallets.findIndex((x) => x.address === address);
    if (index !== -1) {
      state.wallets.splice(index, 1);
      await this.state.write(state);
    }
  }

  /**
   * Signs a transaction of Type T
   * @param address - account to sign the tx with
   * @param tx - Transaction to sign
   */
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

    const state = await this.state.read();
    state.wallets.push({ privateKey, address });
    await this.state.write(state);

    return address;
  }

  private async _getPrivateKeyFor(rawAddress: string): Promise<string> {
    const address = ethers.utils.getAddress(rawAddress);

    const keyPair = (await this.state.read()).wallets.find(
      (x) => x.address === address,
    );

    assert(keyPair !== undefined, 'key does not exist');

    return keyPair.privateKey;
  }

  private async EthersProvider(): Promise<ethers.providers.Provider> {
    for await (const provider of this.provider) {
      if (provider === undefined) {
        continue;
      }

      return new ethers.providers.Web3Provider(provider);
    }

    assert(false, 'Unexpected end of provider cell');
  }

  private async _getContractWalletAddress(privateKey: string): Promise<string> {
    return BlsWalletWrapper.Address(
      privateKey,
      NETWORK_CONFIG.addresses.verificationGateway,
      await this.EthersProvider(),
    );
  }

  private async _getBLSWallet(privateKey: string): Promise<BlsWalletWrapper> {
    return BlsWalletWrapper.connect(
      privateKey,
      NETWORK_CONFIG.addresses.verificationGateway,
      await this.EthersProvider(),
    );
  }
}
