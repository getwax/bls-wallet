import { BigNumber, BigNumberish, ethers, Signer } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import {
  BLSPublicKeyRegistry,
  BLSPublicKeyRegistry__factory as BLSPublicKeyRegistryFactory,
} from "../typechain-types";
import SignerOrProvider from "./helpers/SignerOrProvider";
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from "./SafeSingletonFactory";
import { PublicKey } from "./signer";

/**
 * A wrapper around the `BLSPublicKeyRegistry` contract to provide a more
 * ergonomic interface, especially for `reverseLookup`.
 */
export default class BlsPublicKeyRegistryWrapper {
  constructor(public registry: BLSPublicKeyRegistry) {}

  /**
   * Deploys a new `BLSPublicKeyRegistry` contract the traditional way.
   */
  static async deployNew(signer: Signer): Promise<BlsPublicKeyRegistryWrapper> {
    const factory = new BLSPublicKeyRegistryFactory(signer);

    return new BlsPublicKeyRegistryWrapper(await factory.deploy());
  }

  /**
   * Uses Gnosis Safe's factory to get an `BLSPublicKeyRegistry` contract at a
   * predetermined address. Deploys if it doesn't already exist.
   */
  static async connectOrDeploy(
    signerOrFactory: Signer | SafeSingletonFactory,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<BlsPublicKeyRegistryWrapper> {
    const factory = await SafeSingletonFactory.from(signerOrFactory);

    const registry = await factory.connectOrDeploy(
      BLSPublicKeyRegistryFactory,
      [],
      salt,
    );

    return new BlsPublicKeyRegistryWrapper(registry);
  }

  /**
   * Uses Gnosis Safe's factory to get an `BLSPublicKeyRegistry` contract at a
   * predetermined address. Returns undefined if it doesn't exist.
   */
  static async connectIfDeployed(
    signerOrProvider: SignerOrProvider,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<BlsPublicKeyRegistryWrapper | undefined> {
    const factoryViewer = await SafeSingletonFactoryViewer.from(
      signerOrProvider,
    );

    const registry = await factoryViewer.connectIfDeployed(
      BLSPublicKeyRegistryFactory,
      [],
      salt,
    );

    return registry ? new BlsPublicKeyRegistryWrapper(registry) : undefined;
  }

  /**
   * Uses an id to lookup a public key, the same way that happens on chain.
   */
  async lookup(id: BigNumberish): Promise<PublicKey | undefined> {
    const blsPublicKey = await Promise.all([
      this.registry.blsPublicKeys(id, 0),
      this.registry.blsPublicKeys(id, 1),
      this.registry.blsPublicKeys(id, 2),
      this.registry.blsPublicKeys(id, 3),
    ]);

    if (blsPublicKey.every((x) => x.eq(0))) {
      return undefined;
    }

    return blsPublicKey;
  }

  /**
   * Uses a public key to lookup an id - the reverse of what happens on chain,
   * by making use of the indexed `BLSPublicKeyRegistered` event.
   */
  async reverseLookup(blsPublicKey: PublicKey): Promise<BigNumber | undefined> {
    const blsPublicKeyHash = solidityKeccak256(["uint256[4]"], [blsPublicKey]);

    const events = await this.registry.queryFilter(
      this.registry.filters.BLSPublicKeyRegistered(null, blsPublicKeyHash),
    );

    const id = events.at(-1)?.args?.id;

    return id;
  }

  /**
   * Registers a public key and returns the id.
   */
  async register(blsPublicKey: PublicKey): Promise<BigNumber> {
    await (await this.registry.register(blsPublicKey)).wait();

    const id = await this.reverseLookup(blsPublicKey);

    if (id === undefined) {
      throw new Error("Registration completed but couldn't find id");
    }

    return id;
  }

  /**
   * Registers a public key if it hasn't already been registered, and returns
   * the id that was assigned to it.
   */
  async registerIfNeeded(blsPublicKey: PublicKey): Promise<BigNumber> {
    let id = await this.reverseLookup(blsPublicKey);

    if (id === undefined) {
      id = await this.register(blsPublicKey);
    }

    return id;
  }
}
