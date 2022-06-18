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
      // FIXME: This should be part of the default initialization instead
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

    return await this.createAccount(privateKey);
  }

  async createAccount(privateKey = generateRandomHex(256)): Promise<string> {
    const { wallets } = await this.state.read();

    assert(
      wallets.every((w) => w.privateKey !== privateKey),
      'Wallet already exists',
    );

    const address = await this.BlsWalletAddress(privateKey);

    wallets.push({ privateKey, address });
    await this.state.update({ wallets });

    return address;
  }

  async removeAccount(address: string) {
    const { wallets } = await this.state.read();

    const newWallets = wallets.filter((w) => w.address !== address);
    assert(newWallets.length < wallets.length, 'Account did not exist');

    await this.state.update({ wallets: newWallets });
  }

  /**
   * Signs a transaction of Type T
   * @param address - account to sign the tx with
   * @param tx - Transaction to sign
   */
  async signTransactions(address: string, tx: Operation) {
    return (await this.BlsWalletWrapper(address)).sign(tx);
  }

  async getNonce(address: string) {
    return (await this.BlsWalletWrapper(address)).Nonce();
  }

  private async lookupPrivateKey(rawAddress: string): Promise<string> {
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

      // TODO: Change BlsWalletWrapper so that it can just use a vanilla
      // provider
      return new ethers.providers.Web3Provider(provider);
    }

    assert(false, 'Unexpected end of provider cell');
  }

  private async BlsWalletAddress(privateKey: string): Promise<string> {
    return BlsWalletWrapper.Address(
      privateKey,
      NETWORK_CONFIG.addresses.verificationGateway,
      await this.EthersProvider(),
    );
  }

  private async BlsWalletWrapper(address: string): Promise<BlsWalletWrapper> {
    return BlsWalletWrapper.connect(
      await this.lookupPrivateKey(address),
      NETWORK_CONFIG.addresses.verificationGateway,
      await this.EthersProvider(),
    );
  }
}
