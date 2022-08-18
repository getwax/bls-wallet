import { BlsWalletWrapper } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import { keccak256 } from 'ethers/lib/utils';
import generateRandomHex from '../helpers/generateRandomHex';
import QuillStorageCells from '../QuillStorageCells';
import assert from '../helpers/assert';
import { PartialRpcImpl, RpcClient } from '../types/Rpc';
import ensureType from '../helpers/ensureType';
import BlsNetworksConfig from '../BlsNetworksConfig';
import { IReadableCell } from '../cells/ICell';
import mixtureCopy from '../cells/mixtureCopy';
import getBlsNetworkConfig from './getBlsNetworkConfig';

export default class KeyringController {
  constructor(
    public blsNetworksConfig: BlsNetworksConfig,
    public InternalRpc: () => RpcClient,
    public keyring: QuillStorageCells['keyring'],
    public selectedPublicKeyHash: QuillStorageCells['selectedPublicKeyHash'],
    public network: QuillStorageCells['network'],
    public ethersProvider: IReadableCell<ethers.providers.Provider>,
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    eth_accounts: async ({ origin }) => {
      if (origin === window.location.origin) {
        const walletsNetworkData = await this.getAndUpdateWalletsNetworkData();
        const keyring = await this.keyring.read();

        return keyring.wallets.map((w) => {
          const address = walletsNetworkData[w.publicKeyHash]?.address;

          assert(
            address !== undefined,
            () => new Error('Unexpected missing network data'),
          );

          return address;
        });
      }

      const selectedPublicKeyHash = await this.selectedPublicKeyHash.read();

      // TODO (merge-ok) Expose no accounts if this origin has not been
      // approved, preventing account-requiring RPC methods from completing
      // successfully only show address if account is unlocked
      // https://github.com/web3well/bls-wallet/issues/224
      return selectedPublicKeyHash
        ? [await this.InternalRpc().pkHashToAddress(selectedPublicKeyHash)]
        : [];
    },

    eth_requestAccounts: async (_request) => {
      const selectedAddress = await this.selectedPublicKeyHash.read();
      const accounts = selectedAddress ? [selectedAddress] : [];
      return accounts;
    },

    eth_coinbase: async (_request) => {
      const selectedPublicKeyHash = await this.selectedPublicKeyHash.read();

      if (selectedPublicKeyHash === undefined) {
        return null;
      }

      return await this.InternalRpc().pkHashToAddress(selectedPublicKeyHash);
    },

    /**
     * Creates a Deterministic Account based on seed phrase
     */
    addHDAccount: async (_request) => {
      const { HDPhrase, nextHDIndex } = await this.keyring.read();
      const node = ethers.utils.HDNode.fromMnemonic(HDPhrase);

      const { privateKey } = node.derivePath(`m/44'/60'/0'/0/${nextHDIndex}`);

      const address: string = await this.InternalRpc().addAccount(privateKey);
      await this.keyring.update({ nextHDIndex: nextHDIndex + 1 });

      return address;
    },

    setHDPhrase: async ({ params: [HDPhrase] }) => {
      await this.keyring.update({ HDPhrase });
    },

    lookupPrivateKey: async ({ params: [rawAddress] }) => {
      const address = ethers.utils.getAddress(rawAddress);
      const network = await this.network.read();

      const keyPair = (await this.keyring.read()).wallets.find(
        (x) => x.networks[network.networkKey]?.address === address,
      );

      assert(keyPair !== undefined, () => new Error('key does not exist'));

      return keyPair.privateKey;
    },

    pkHashToAddress: async ({ params: [publicKeyHash] }) => {
      const walletsNetworkData = await this.getAndUpdateWalletsNetworkData();
      const networkData = walletsNetworkData[publicKeyHash];

      assert(
        networkData !== undefined,
        () => new Error('Unexpected missing network data'),
      );

      return networkData.address;
    },

    addAccount: async ({ params: [privateKey = generateRandomHex(256)] }) => {
      const { wallets } = await this.keyring.read();

      assert(
        wallets.every((w) => w.privateKey !== privateKey),
        () => new Error('Wallet already exists'),
      );

      const blsWalletWrapper = await this.BlsWalletWrapper(privateKey);
      const network = await this.network.read();

      const blsNetworkConfig = getBlsNetworkConfig(
        network,
        this.blsNetworksConfig,
      );

      wallets.push({
        privateKey,
        publicKeyHash: keccak256(blsWalletWrapper.PublicKeyStr()),
        networks: {
          [network.networkKey]: {
            address: blsWalletWrapper.address,
            originalGateway: blsNetworkConfig.addresses.verificationGateway,
          },
        },
      });

      await this.keyring.update({ wallets });

      return blsWalletWrapper.address;
    },

    removeAccount: async ({ params: [address] }) => {
      const { wallets } = await this.keyring.read();
      const network = await this.network.read();

      const newWallets = wallets.filter(
        (w) => w.networks[network.networkKey]?.address !== address,
      );

      assert(
        newWallets.length < wallets.length,
        () => new Error('Account did not exist'),
      );

      await this.keyring.update({ wallets: newWallets });
    },
  });

  async BlsWalletWrapper(privateKey: string): Promise<BlsWalletWrapper> {
    const blsNetworkConfig = getBlsNetworkConfig(
      await this.network.read(),
      this.blsNetworksConfig,
    );

    return BlsWalletWrapper.connect(
      privateKey,
      blsNetworkConfig.addresses.verificationGateway,
      await this.ethersProvider.read(),
    );
  }

  async getAndUpdateWalletsNetworkData(): Promise<
    Record<string, { originalGateway: string; address: string } | undefined>
  > {
    // Load keyring & network
    const [network, keyring] = await Promise.all([
      this.network.read(),
      this.keyring.read(),
    ]);
    const keyringCopy = mixtureCopy(keyring);

    const blsNetworkConfig = getBlsNetworkConfig(
      network,
      this.blsNetworksConfig,
    );

    // Get network data for wallets
    let shouldUpdateKeyring = false;
    const networkDataForWallets = await Promise.all(
      keyringCopy.wallets.map(async (w) => {
        // Return existing network data
        const walletNetworkData = w.networks[network.networkKey];
        if (walletNetworkData) {
          return walletNetworkData;
        }

        // Otherwise generate new network data
        shouldUpdateKeyring = true;
        const { address } = await this.BlsWalletWrapper(w.privateKey);
        return {
          originalGateway: blsNetworkConfig.addresses.verificationGateway,
          address,
        };
      }),
    );
    // TODO Find a better way where we don't have to loop through every entry.
    for (const [i, w] of keyringCopy.wallets.entries()) {
      w.networks[network.networkKey] = networkDataForWallets[i];
    }

    // Update keyring if new netowrk data was created
    if (shouldUpdateKeyring) {
      await this.keyring.write(keyringCopy);
    }

    // Return all wallet network data by PubKey hash
    return keyringCopy.wallets.reduce(
      (acc, w) => ({
        ...acc,
        [w.publicKeyHash]: w.networks[network.networkKey],
      }),
      {},
    );
  }
}
