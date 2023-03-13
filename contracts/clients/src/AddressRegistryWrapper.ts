/* eslint-disable camelcase */

import { BigNumber, BigNumberish, ethers, Signer } from "ethers";
import { AddressRegistry } from "../typechain-types/contracts/AddressRegistry";
import { AddressRegistry__factory } from "../typechain-types/factories/contracts/AddressRegistry__factory";
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from "./SafeSingletonFactory";

export default class AddressRegistryWrapper {
  constructor(public registry: AddressRegistry) {}

  static async deployNew(signer: Signer): Promise<AddressRegistryWrapper> {
    const factory = new AddressRegistry__factory(signer);

    return new AddressRegistryWrapper(await factory.deploy());
  }

  static async connectOrDeploy(
    signerOrFactory: Signer | SafeSingletonFactory,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<AddressRegistryWrapper> {
    let factory: SafeSingletonFactory;

    if (signerOrFactory instanceof SafeSingletonFactory) {
      factory = signerOrFactory;
    } else {
      factory = await SafeSingletonFactory.init(signerOrFactory);
    }

    const registry = await factory.connectOrDeploy(
      AddressRegistry__factory,
      [],
      salt,
    );

    return new AddressRegistryWrapper(registry);
  }

  static async connectIfDeployed(
    provider: ethers.providers.Provider,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<AddressRegistryWrapper | undefined> {
    const factoryViewer = new SafeSingletonFactoryViewer(
      provider,
      (await provider.getNetwork()).chainId,
    );

    const registry = await factoryViewer.connectIfDeployed(
      AddressRegistry__factory,
      [],
      salt,
    );

    return registry ? new AddressRegistryWrapper(registry) : undefined;
  }

  async lookup(id: BigNumberish): Promise<string | undefined> {
    const address = await this.registry.addresses(id);

    return address === ethers.constants.AddressZero ? undefined : address;
  }

  async reverseLookup(address: string): Promise<BigNumber | undefined> {
    const events = await this.registry.queryFilter(
      this.registry.filters.AddressRegistered(null, address),
    );

    const id = events.at(-1)?.args?.id;

    return id;
  }

  async register(address: string): Promise<BigNumber> {
    await (await this.registry.register(address)).wait();

    const id = await this.reverseLookup(address);

    if (id === undefined) {
      throw new Error("Registration completed but couldn't find id");
    }

    return id;
  }

  async registerIfNeeded(address: string): Promise<BigNumber> {
    let id = await this.reverseLookup(address);

    if (id === undefined) {
      id = await this.register(address);
    }

    return id;
  }
}
