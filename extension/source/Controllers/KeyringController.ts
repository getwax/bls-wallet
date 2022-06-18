import { BlsWalletWrapper } from 'bls-wallet-clients';
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

  async lookupWallet(address: string): Promise<BlsWalletWrapper> {
    return BlsWalletWrapper.connect(
      await this.lookupPrivateKey(address),
      NETWORK_CONFIG.addresses.verificationGateway,
      await this.EthersProvider(),
    );
  }

  /**
   * Creates a Deterministic Account based on seed phrase
   */
  async createHDAccount(): Promise<string> {
    const mnemonic = (await this.state.read()).HDPhrase;
    const node = ethers.utils.HDNode.fromMnemonic(mnemonic);

    // FIXME: HD accounts are co-mingled with regular accounts. This will cause
    // us to skip over HD accounts that should have been created whenever there
    // is a regular account taking up its spot.
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

      // FIXME: BlsWalletWrapper should just support a vanilla provider
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
}
