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

export default class BlsPublicKeyRegistryWrapper {
  constructor(public registry: BLSPublicKeyRegistry) {}

  static async deployNew(signer: Signer): Promise<BlsPublicKeyRegistryWrapper> {
    const factory = new BLSPublicKeyRegistryFactory(signer);

    return new BlsPublicKeyRegistryWrapper(await factory.deploy());
  }

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

  async reverseLookup(blsPublicKey: PublicKey): Promise<BigNumber | undefined> {
    const blsPublicKeyHash = solidityKeccak256(["uint256[4]"], [blsPublicKey]);

    const events = await this.registry.queryFilter(
      this.registry.filters.BLSPublicKeyRegistered(null, blsPublicKeyHash),
    );

    const id = events.at(-1)?.args?.id;

    return id;
  }

  async register(blsPublicKey: PublicKey): Promise<BigNumber> {
    await (await this.registry.register(blsPublicKey)).wait();

    const id = await this.reverseLookup(blsPublicKey);

    if (id === undefined) {
      throw new Error("Registration completed but couldn't find id");
    }

    return id;
  }

  async registerIfNeeded(blsPublicKey: PublicKey): Promise<BigNumber> {
    let id = await this.reverseLookup(blsPublicKey);

    if (id === undefined) {
      id = await this.register(blsPublicKey);
    }

    return id;
  }
}
