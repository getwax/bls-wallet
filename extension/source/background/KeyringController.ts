import { BlsWalletWrapper } from 'bls-wallet-clients';
import { ethers } from 'ethers';
import generateRandomHex from '../helpers/generateRandomHex';
import QuillStorageCells from '../QuillStorageCells';
import assert from '../helpers/assert';
import { PartialRpcImpl, RpcClient } from '../types/Rpc';
import ensureType from '../helpers/ensureType';
import blsNetworksConfig from '../blsNetworksConfig';
import { IReadableCell } from '../cells/ICell';
import mixtureCopy from '../cells/mixtureCopy';

export default class KeyringController {
  constructor(
    public InternalRpc: () => RpcClient,
    public keyring: QuillStorageCells['keyring'],
    public selectedAddress: QuillStorageCells['selectedAddress'],
    public network: QuillStorageCells['network'],
    public ethersProvider: IReadableCell<ethers.providers.Provider>,
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    eth_accounts: async ({ origin }) => {
      if (origin === window.location.origin) {
        const network = await this.network.read();
        const blsNetworkConfig = blsNetworksConfig[network.networkKey];

        const keyring = mixtureCopy(await this.keyring.read());
        let keyringUpdated = false;

        const addresses = await Promise.all(
          keyring.wallets.map(async (wallet) => {
            let networkDataForWallet = wallet.networks[network.networkKey];

            if (networkDataForWallet === undefined) {
              assert(
                blsNetworkConfig !== undefined,
                () =>
                  new Error(
                    `Missing bls network config for ${network.displayName}`,
                  ),
              );

              networkDataForWallet = {
                originalGateway: blsNetworkConfig.addresses.verificationGateway,
                address: await this.BlsWalletAddress(wallet.privateKey),
              };

              // eslint-disable-next-line no-param-reassign
              wallet.networks[network.networkKey] = networkDataForWallet;
              keyringUpdated = true;
            }

            return networkDataForWallet.address;
          }),
        );

        if (keyringUpdated) {
          await this.keyring.write(keyring);
        }

        return addresses;
      }

      const selectedAddress = await this.selectedAddress.read();

      // TODO (merge-ok) Expose no accounts if this origin has not been
      // approved, preventing account-requiring RPC methods from completing
      // successfully only show address if account is unlocked
      // https://github.com/web3well/bls-wallet/issues/224
      return selectedAddress ? [selectedAddress] : [];
    },

    eth_requestAccounts: async (_request) => {
      const selectedAddress = await this.selectedAddress.read();
      const accounts = selectedAddress ? [selectedAddress] : [];
      return accounts;
    },

    eth_coinbase: async (_request) =>
      (await this.selectedAddress.read()) ?? null,

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

    addAccount: async ({ params: [privateKey = generateRandomHex(256)] }) => {
      const { wallets } = await this.keyring.read();

      assert(
        wallets.every((w) => w.privateKey !== privateKey),
        () => new Error('Wallet already exists'),
      );

      const address = await this.BlsWalletAddress(privateKey);

      const network = await this.network.read();
      const blsNetworkConfig = blsNetworksConfig[network.networkKey];

      // FIXME: Duplication of this
      assert(
        blsNetworkConfig !== undefined,
        () =>
          new Error(`bls network config not found for ${network.displayName}`),
      );

      wallets.push({
        privateKey,
        networks: {
          [network.networkKey]: {
            address,
            originalGateway: blsNetworkConfig.addresses.verificationGateway,
          },
        },
      });

      await this.keyring.update({ wallets });

      return address;
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

  async BlsWalletAddress(privateKey: string): Promise<string> {
    const network = await this.network.read();
    const blsNetworkConfig = blsNetworksConfig[network.networkKey];

    assert(
      blsNetworkConfig !== undefined,
      () => new Error(`Missing bls network config for ${network.displayName}`),
    );

    return BlsWalletWrapper.Address(
      privateKey,
      blsNetworkConfig.addresses.verificationGateway,
      await this.ethersProvider.read(),
    );
  }
}
