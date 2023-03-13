/* eslint-disable camelcase */

import { ethers, Signer } from "ethers";
import {
  AddressRegistry__factory,
  BLSPublicKeyRegistry__factory,
  FallbackExpander,
  FallbackExpander__factory,
} from "../typechain-types";
import AddressRegistryWrapper from "./AddressRegistryWrapper";
import BlsPublicKeyRegistryWrapper from "./BlsPublicKeyRegistryWrapper";
import {
  encodeBitStream,
  encodePseudoFloat,
  encodeRegIndex,
  encodeVLQ,
  hexJoin,
} from "./encodeUtils";
import IOperationCompressor from "./IOperationCompressor";
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from "./SafeSingletonFactory";
import { Operation, PublicKey } from "./signer";

export default class FallbackCompressor implements IOperationCompressor {
  private constructor(
    public fallbackExpander: FallbackExpander,
    public blsPublicKeyRegistry: BlsPublicKeyRegistryWrapper,
    public addressRegistry: AddressRegistryWrapper,
  ) {}

  static async wrap(
    fallbackExpander: FallbackExpander,
  ): Promise<FallbackCompressor> {
    if (fallbackExpander.signer === undefined) {
      throw new Error("A signer is required");
    }

    return new FallbackCompressor(
      fallbackExpander,
      new BlsPublicKeyRegistryWrapper(
        BLSPublicKeyRegistry__factory.connect(
          await fallbackExpander.blsPublicKeyRegistry(),
          fallbackExpander.signer,
        ),
      ),
      new AddressRegistryWrapper(
        AddressRegistry__factory.connect(
          await fallbackExpander.addressRegistry(),
          fallbackExpander.signer,
        ),
      ),
    );
  }

  static async deployNew(signer: Signer): Promise<FallbackCompressor> {
    const blsPublicKeyRegistryFactory = new BLSPublicKeyRegistry__factory(
      signer,
    );

    const addressRegistryFactory = new AddressRegistry__factory(signer);

    const [blsPublicKeyRegistryContract, addressRegistryContract] =
      await Promise.all([
        blsPublicKeyRegistryFactory.deploy(),
        addressRegistryFactory.deploy(),
      ]);

    const fallbackExpanderFactory = new FallbackExpander__factory(signer);

    const fallbackExpanderContract = await fallbackExpanderFactory.deploy(
      blsPublicKeyRegistryContract.address,
      addressRegistryContract.address,
    );

    return new FallbackCompressor(
      fallbackExpanderContract,
      new BlsPublicKeyRegistryWrapper(blsPublicKeyRegistryContract),
      new AddressRegistryWrapper(addressRegistryContract),
    );
  }

  static async connectOrDeploy(
    signerOrFactory: Signer | SafeSingletonFactory,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<FallbackCompressor> {
    let factory: SafeSingletonFactory;

    if (signerOrFactory instanceof SafeSingletonFactory) {
      factory = signerOrFactory;
    } else {
      factory = await SafeSingletonFactory.init(signerOrFactory);
    }

    const [blsPublicKeyRegistry, addressRegistry] = await Promise.all([
      BlsPublicKeyRegistryWrapper.connectOrDeploy(factory, salt),
      AddressRegistryWrapper.connectOrDeploy(factory, salt),
    ]);

    const fallbackExpanderContract = await factory.connectOrDeploy(
      FallbackExpander__factory,
      [blsPublicKeyRegistry.registry.address, addressRegistry.registry.address],
      salt,
    );

    return new FallbackCompressor(
      fallbackExpanderContract,
      blsPublicKeyRegistry,
      addressRegistry,
    );
  }

  static async connectIfDeployed(
    provider: ethers.providers.Provider,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<FallbackCompressor | undefined> {
    const factoryViewer = new SafeSingletonFactoryViewer(
      provider,
      (await provider.getNetwork()).chainId,
    );

    const blsPublicKeyRegistry = await factoryViewer.connectIfDeployed(
      BLSPublicKeyRegistry__factory,
      [],
      salt,
    );

    if (!blsPublicKeyRegistry) {
      return undefined;
    }

    const addressRegistry = await factoryViewer.connectIfDeployed(
      AddressRegistry__factory,
      [],
      salt,
    );

    if (!addressRegistry) {
      return undefined;
    }

    const fallbackExpander = await factoryViewer.connectIfDeployed(
      FallbackExpander__factory,
      [blsPublicKeyRegistry.address, addressRegistry.address],
      salt,
    );

    if (!fallbackExpander) {
      return undefined;
    }

    return new FallbackCompressor(
      fallbackExpander,
      new BlsPublicKeyRegistryWrapper(blsPublicKeyRegistry),
      new AddressRegistryWrapper(addressRegistry),
    );
  }

  async compress(blsPublicKey: PublicKey, operation: Operation) {
    const result: string[] = [];

    const resultIndexForRegUsageBitStream = result.length;
    const regUsageBitStream: boolean[] = [];
    result.push("0x"); // Placeholder to overwrite

    const blsPublicKeyId = await this.blsPublicKeyRegistry.reverseLookup(
      blsPublicKey,
    );

    if (blsPublicKeyId === undefined) {
      regUsageBitStream.push(false);

      result.push(
        ethers.utils.defaultAbiCoder.encode(["uint256[4]"], [blsPublicKey]),
      );
    } else {
      regUsageBitStream.push(true);
      result.push(encodeRegIndex(blsPublicKeyId));
    }

    result.push(encodeVLQ(operation.nonce));
    result.push(encodePseudoFloat(operation.gas));

    result.push(encodeVLQ(operation.actions.length));

    for (const action of operation.actions) {
      result.push(encodePseudoFloat(action.ethValue));

      const addressId = await this.addressRegistry.reverseLookup(
        action.contractAddress,
      );

      if (addressId === undefined) {
        regUsageBitStream.push(false);
        result.push(action.contractAddress);
      } else {
        regUsageBitStream.push(true);
        result.push(encodeRegIndex(addressId));
      }

      const fnHex = ethers.utils.hexlify(action.encodedFunction);
      const fnLen = (fnHex.length - 2) / 2;

      result.push(encodeVLQ(fnLen));
      result.push(fnHex);
    }

    result[resultIndexForRegUsageBitStream] =
      encodeBitStream(regUsageBitStream);

    return hexJoin(result);
  }
}
