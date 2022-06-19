import { BlsWalletWrapper } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import generateRandomHex from '../helpers/generateRandomHex';
import { NETWORK_CONFIG } from '../env';
import QuillCells from '../QuillCells';
import assert from '../helpers/assert';
import NetworkController from './NetworkController';
import { PartialRpcImpl } from '../types/Rpc';
import ensureType from '../helpers/ensureType';

export default class KeyringController {
  // FIXME: BlsWalletWrapper should just support a vanilla provider
  public ethersProvider: ethers.providers.Provider;

  constructor(
    public keyring: QuillCells['keyring'],
    public selectedAddress: QuillCells['selectedAddress'],
    public networkController: NetworkController,
  ) {
    this.ethersProvider = new ethers.providers.Web3Provider(networkController);
  }

  rpc = ensureType<PartialRpcImpl>()({
    eth_accounts: async ({ origin }) => {
      if (origin === window.location.origin) {
        return (await this.keyring.read()).wallets.map(
          ({ address }) => address,
        );
      }

      const selectedAddress = await this.selectedAddress.read();

      // TODO (merge-ok) Expose no accounts if this origin has not been
      // approved, preventing account-requiring RPC methods from completing
      // successfully only show address if account is unlocked
      // https://github.com/web3well/bls-wallet/issues/224
      return selectedAddress ? [selectedAddress] : [];
    },

    eth_requestAccounts: async (_message) => {
      const selectedAddress = await this.selectedAddress.read();
      const accounts = selectedAddress ? [selectedAddress] : [];
      return accounts;
    },

    eth_coinbase: async (_message) =>
      (await this.selectedAddress.read()) ?? null,

    createHDAccount: async (_message) => {
      return this.createHDAccount();
    },

    setHDPhrase: async ({ params: [HDPhrase] }) => {
      this.keyring.update({ HDPhrase });
      return 'ok';
    },

    isOnboardingComplete: async (_message) => {
      return (await this.keyring.read()).HDPhrase !== undefined;
    },
  });

  async lookupWallet(address: string): Promise<BlsWalletWrapper> {
    return BlsWalletWrapper.connect(
      await this.lookupPrivateKey(address),
      NETWORK_CONFIG.addresses.verificationGateway,
      this.ethersProvider,
    );
  }

  /**
   * Creates a Deterministic Account based on seed phrase
   */
  async createHDAccount(): Promise<string> {
    const mnemonic = (await this.keyring.read()).HDPhrase;
    const node = ethers.utils.HDNode.fromMnemonic(mnemonic);

    // FIXME: HD accounts are co-mingled with regular accounts. This will cause
    // us to skip over HD accounts that should have been created whenever there
    // is a regular account taking up its spot.
    const newAccountIndex = (await this.keyring.read()).wallets.length;
    const { privateKey } = node.derivePath(`m/44'/60'/0'/0/${newAccountIndex}`);

    return await this.createAccount(privateKey);
  }

  async createAccount(privateKey = generateRandomHex(256)): Promise<string> {
    const { wallets } = await this.keyring.read();

    assert(
      wallets.every((w) => w.privateKey !== privateKey),
      'Wallet already exists',
    );

    const address = await this.BlsWalletAddress(privateKey);

    wallets.push({ privateKey, address });
    await this.keyring.update({ wallets });

    return address;
  }

  async removeAccount(address: string) {
    const { wallets } = await this.keyring.read();

    const newWallets = wallets.filter((w) => w.address !== address);
    assert(newWallets.length < wallets.length, 'Account did not exist');

    await this.keyring.update({ wallets: newWallets });
  }

  private async lookupPrivateKey(rawAddress: string): Promise<string> {
    const address = ethers.utils.getAddress(rawAddress);

    const keyPair = (await this.keyring.read()).wallets.find(
      (x) => x.address === address,
    );

    assert(keyPair !== undefined, 'key does not exist');

    return keyPair.privateKey;
  }

  private async BlsWalletAddress(privateKey: string): Promise<string> {
    return BlsWalletWrapper.Address(
      privateKey,
      NETWORK_CONFIG.addresses.verificationGateway,
      this.ethersProvider,
    );
  }
}
