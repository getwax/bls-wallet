import { BigNumber, BigNumberish, ethers, Signer } from "ethers";
import { AddressRegistry } from "../typechain-types/contracts/AddressRegistry";
import { AddressRegistry__factory as AddressRegistryFactory } from "../typechain-types/factories/contracts/AddressRegistry__factory";
import SignerOrProvider from "./helpers/SignerOrProvider";
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from "./SafeSingletonFactory";

/**
 * A wrapper around the `AddressRegistry` contract to provide a more ergonomic
 * interface, especially for `reverseLookup`.
 */
export default class AddressRegistryWrapper {
  constructor(public registry: AddressRegistry) {}

  /**
   * Deploys a new `AddressRegistry` contract the traditional way.
   */
  static async deployNew(signer: Signer): Promise<AddressRegistryWrapper> {
    const factory = new AddressRegistryFactory(signer);

    return new AddressRegistryWrapper(await factory.deploy());
  }

  /**
   * Uses Gnosis Safe's factory to get an `AddressRegistry` contract at a
   * predetermined address. Deploys if it doesn't already exist.
   */
  static async connectOrDeploy(
    signerOrFactory: Signer | SafeSingletonFactory,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<AddressRegistryWrapper> {
    const factory = await SafeSingletonFactory.from(signerOrFactory);

    const registry = await factory.connectOrDeploy(
      AddressRegistryFactory,
      [],
      salt,
    );

    return new AddressRegistryWrapper(registry);
  }

  /**
   * Uses Gnosis Safe's factory to get an `AddressRegistry` contract at a
   * predetermined address. Returns undefined if it doesn't exist.
   */
  static async connectIfDeployed(
    signerOrProvider: SignerOrProvider,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<AddressRegistryWrapper | undefined> {
    const factoryViewer = await SafeSingletonFactoryViewer.from(
      signerOrProvider,
    );

    const registry = await factoryViewer.connectIfDeployed(
      AddressRegistryFactory,
      [],
      salt,
    );

    return registry ? new AddressRegistryWrapper(registry) : undefined;
  }

  /**
   * Uses an id to lookup an address, the same way that happens on chain.
   */
  async lookup(id: BigNumberish): Promise<string | undefined> {
    const address = await this.registry.addresses(id);

    return address === ethers.constants.AddressZero ? undefined : address;
  }

  /**
   * Uses an address to lookup an id - the reverse of what happens on chain, by
   * making use of the indexed `AddressRegistered` event.
   */
  async reverseLookup(address: string): Promise<BigNumber | undefined> {
    const events = await this.registry.queryFilter(
      this.registry.filters.AddressRegistered(null, address),
    );

    const id = events.at(-1)?.args?.id;

    return id;
  }

  /**
   * Registers an address and returns the id that was assigned to it.
   */
  async register(address: string): Promise<BigNumber> {
    await (await this.registry.register(address)).wait();

    const id = await this.reverseLookup(address);

    if (id === undefined) {
      throw new Error("Registration completed but couldn't find id");
    }

    return id;
  }

  /**
   * Registers an address if it hasn't already been registered, and returns the
   * id that was assigned to it.
   */
  async registerIfNeeded(address: string): Promise<BigNumber> {
    let id = await this.reverseLookup(address);

    if (id === undefined) {
      id = await this.register(address);
    }

    return id;
  }
}
