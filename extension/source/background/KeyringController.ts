import {
  BlsWalletWrapper,
  // eslint-disable-next-line camelcase
  VerificationGateway__factory,
  Aggregator,
} from 'bls-wallet-clients';
import { ethers, BigNumberish } from 'ethers';
import { solidityPack, keccak256 } from 'ethers/lib/utils';
import generateRandomHex from '../helpers/generateRandomHex';
import QuillStorageCells from '../QuillStorageCells';
import assert from '../helpers/assert';
import { PartialRpcImpl, RpcClient } from '../types/Rpc';
import ensureType from '../helpers/ensureType';
import { MultiNetworkConfig } from '../MultiNetworkConfig';
import { IReadableCell } from '../cells/ICell';
import mixtureCopy from '../cells/mixtureCopy';
import getNetworkConfig from './getNetworkConfig';

export default class KeyringController {
  constructor(
    public multiNetworkConfig: MultiNetworkConfig,
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

    createTempAccount: async (_request) => {
      const pKey = generateRandomHex(256);
      const { wallets } = await this.keyring.read();

      assert(
        wallets.every((w) => w.privateKey !== pKey),
        () => new Error('Wallet already exists'),
      );

      const { address, privateKey } = await this.BlsWalletWrapper(pKey);
      return { address, privateKey };
    },

    addAccount: async ({ params: [privateKey = generateRandomHex(256)] }) => {
      const { wallets } = await this.keyring.read();

      assert(
        wallets.every((w) => w.privateKey !== privateKey),
        () => new Error('Wallet already exists'),
      );

      const blsWalletWrapper = await this.BlsWalletWrapper(privateKey);
      const network = await this.network.read();

      const netCfg = getNetworkConfig(network, this.multiNetworkConfig);

      wallets.push({
        privateKey,
        publicKeyHash: keccak256(blsWalletWrapper.PublicKeyStr()),
        networks: {
          [network.networkKey]: {
            address: blsWalletWrapper.address,
            originalGateway: netCfg.addresses.verificationGateway,
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

    /**
     * Recovers an existing BLS wallet and adds the new
     * recovered wallet to the keyring
     * @param recoveryWalletAddress Smart contract address
     * of wallet being recovered
     * @param recoverySaltHash Salt used to set the recovery
     * hash on the wallet that is being recovered
     * @param signerWalletPrivateKey the private key of the wallet that is used
     * to generate the recovery hash. This wallet will sign the 'recoverWallet'
     * request.
     */
    addRecoveryWallet: async ({
      params: [recoveryWalletAddress, recoverySaltHash, signerWalletPrivateKey],
    }) => {
      const privateKey = await this.recoverWallet(
        recoveryWalletAddress,
        recoverySaltHash,
        signerWalletPrivateKey,
      );

      // Add new private key to the keyring
      await this.InternalRpc().addAccount(privateKey);
    },
  });

  async BlsWalletWrapper(privateKey: string): Promise<BlsWalletWrapper> {
    const netCfg = getNetworkConfig(
      await this.network.read(),
      this.multiNetworkConfig,
    );

    return BlsWalletWrapper.connect(
      privateKey,
      netCfg.addresses.verificationGateway,
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

    const netCfg = getNetworkConfig(network, this.multiNetworkConfig);

    // Update network data for wallets
    let shouldUpdateKeyring = false;
    await Promise.all(
      keyringCopy.wallets.map(async (w, i) => {
        const walletNetworkData = w.networks[network.networkKey];
        if (walletNetworkData) {
          return;
        }

        // Create new network data
        shouldUpdateKeyring = true;
        const { address } = await this.BlsWalletWrapper(w.privateKey);
        keyringCopy.wallets[i].networks[network.networkKey] = {
          originalGateway: netCfg.addresses.verificationGateway,
          address,
        };
      }),
    );

    // Update keyring if new network data was created
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

  async signWalletAddress(
    senderAddress: string,
    signerPrivateKey: string,
  ): Promise<[BigNumberish, BigNumberish]> {
    const netCfg = getNetworkConfig(
      await this.network.read(),
      this.multiNetworkConfig,
    );

    const addressMessage = solidityPack(['address'], [senderAddress]);
    const wallet = await BlsWalletWrapper.connect(
      signerPrivateKey,
      netCfg.addresses.verificationGateway,
      await this.ethersProvider.read(),
    );
    return wallet.signMessage(addressMessage);
  }

  async recoverWallet(
    recoveryWalletAddress: string,
    recoverySaltHash: string,
    signerWalletPrivateKey: string,
  ): Promise<string> {
    const network = await this.network.read();
    const netCfg = getNetworkConfig(network, this.multiNetworkConfig);

    // Create new private key for the wallet we are recovering to.
    const newPrivateKey = generateRandomHex(256);

    const addressSignature = await this.signWalletAddress(
      recoveryWalletAddress,
      newPrivateKey,
    );

    // Get instance of the new wallet, so we can get the public key
    // to pass to the recoverWallet method.
    const newWalletWrapper = await this.BlsWalletWrapper(newPrivateKey);

    // eslint-disable-next-line camelcase
    const verificationGatewayContract = VerificationGateway__factory.connect(
      netCfg.addresses.verificationGateway,
      await this.ethersProvider.read(),
    );

    const recoveryWalletHash = await verificationGatewayContract.hashFromWallet(
      recoveryWalletAddress,
    );

    const signerWallet = await this.BlsWalletWrapper(signerWalletPrivateKey);

    const nonce = await BlsWalletWrapper.Nonce(
      signerWallet.PublicKey(),
      netCfg.addresses.verificationGateway,
      await this.ethersProvider.read(),
    );

    // Thought about using this.InternalRpc().eth_sendTransaction() here.
    // However since we are generating a wallet on the fly and not using
    // an existing wallet in the keyring I am calling creating a bundle
    // manually and submitting it to the aggregator.
    const bundle = signerWallet.sign({
      nonce,
      actions: [
        {
          ethValue: 0,
          contractAddress: verificationGatewayContract.address,
          encodedFunction:
            verificationGatewayContract.interface.encodeFunctionData(
              'recoverWallet',
              [
                addressSignature,
                recoveryWalletHash,
                recoverySaltHash,
                newWalletWrapper.PublicKey(),
              ],
            ),
        },
      ],
    });

    const { aggregatorUrl } = network;
    const agg = new Aggregator(aggregatorUrl);
    const result = await agg.add(bundle);

    assert(!('failures' in result), () => new Error(JSON.stringify(result)));

    return newPrivateKey;
  }
}
