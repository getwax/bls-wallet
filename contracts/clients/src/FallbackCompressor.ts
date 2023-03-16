import { ethers, Signer } from "ethers";
import {
  AddressRegistry__factory as AddressRegistryFactory,
  BLSPublicKeyRegistry__factory as BLSPublicKeyRegistryFactory,
  FallbackExpander,
  FallbackExpander__factory as FallbackExpanderFactory,
  AggregatorUtilities,
  AggregatorUtilities__factory as AggregatorUtilitiesFactory,
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
import SignerOrProvider from "./helpers/SignerOrProvider";
import IOperationCompressor from "./IOperationCompressor";
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from "./SafeSingletonFactory";
import { ActionData, Operation, PublicKey } from "./signer/types";

export default class FallbackCompressor implements IOperationCompressor {
  private constructor(
    public fallbackExpander: FallbackExpander,
    public blsPublicKeyRegistry: BlsPublicKeyRegistryWrapper,
    public addressRegistry: AddressRegistryWrapper,
    public aggregatorUtilities: AggregatorUtilities,
  ) {}

  static async wrap(
    fallbackExpander: FallbackExpander,
  ): Promise<FallbackCompressor> {
    const [
      blsPublicKeyRegistryAddress,
      addressRegistryAddress,
      aggregatorUtilitiesAddress,
    ] = await Promise.all([
      fallbackExpander.blsPublicKeyRegistry(),
      fallbackExpander.addressRegistry(),
      fallbackExpander.aggregatorUtilities(),
    ]);

    return new FallbackCompressor(
      fallbackExpander,
      new BlsPublicKeyRegistryWrapper(
        BLSPublicKeyRegistryFactory.connect(
          blsPublicKeyRegistryAddress,
          fallbackExpander.signer,
        ),
      ),
      new AddressRegistryWrapper(
        AddressRegistryFactory.connect(
          addressRegistryAddress,
          fallbackExpander.signer,
        ),
      ),
      AggregatorUtilitiesFactory.connect(
        aggregatorUtilitiesAddress,
        fallbackExpander.signer,
      ),
    );
  }

  static async deployNew(signer: Signer): Promise<FallbackCompressor> {
    const blsPublicKeyRegistryFactory = new BLSPublicKeyRegistryFactory(signer);
    const addressRegistryFactory = new AddressRegistryFactory(signer);
    const aggregatorUtilitiesFactory = new AggregatorUtilitiesFactory(signer);

    const [
      blsPublicKeyRegistryContract,
      addressRegistryContract,
      aggregatorUtilitiesContract,
    ] = await Promise.all([
      blsPublicKeyRegistryFactory.deploy(),
      addressRegistryFactory.deploy(),
      aggregatorUtilitiesFactory.deploy(),
    ]);

    const fallbackExpanderFactory = new FallbackExpanderFactory(signer);

    const fallbackExpanderContract = await fallbackExpanderFactory.deploy(
      blsPublicKeyRegistryContract.address,
      addressRegistryContract.address,
      aggregatorUtilitiesContract.address,
    );

    return new FallbackCompressor(
      fallbackExpanderContract,
      new BlsPublicKeyRegistryWrapper(blsPublicKeyRegistryContract),
      new AddressRegistryWrapper(addressRegistryContract),
      aggregatorUtilitiesContract,
    );
  }

  static async connectOrDeploy(
    signerOrFactory: Signer | SafeSingletonFactory,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<FallbackCompressor> {
    const factory = await SafeSingletonFactory.from(signerOrFactory);

    const [blsPublicKeyRegistry, addressRegistry, aggregatorUtilities] =
      await Promise.all([
        BlsPublicKeyRegistryWrapper.connectOrDeploy(factory, salt),
        AddressRegistryWrapper.connectOrDeploy(factory, salt),
        factory.connectOrDeploy(AggregatorUtilitiesFactory, [], salt),
      ]);

    const fallbackExpanderContract = await factory.connectOrDeploy(
      FallbackExpanderFactory,
      [
        blsPublicKeyRegistry.registry.address,
        addressRegistry.registry.address,
        aggregatorUtilities.address,
      ],
      salt,
    );

    return new FallbackCompressor(
      fallbackExpanderContract,
      blsPublicKeyRegistry,
      addressRegistry,
      aggregatorUtilities,
    );
  }

  static async connectIfDeployed(
    signerOrProvider: SignerOrProvider,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<FallbackCompressor | undefined> {
    const factoryViewer = await SafeSingletonFactoryViewer.from(
      signerOrProvider,
    );

    const [
      blsPublicKeyRegistryAddress,
      addressRegistryAddress,
      aggregatorUtilitiesAddress,
    ] = await Promise.all([
      factoryViewer.calculateAddress(BLSPublicKeyRegistryFactory, [], salt),
      factoryViewer.calculateAddress(AddressRegistryFactory, [], salt),
      factoryViewer.calculateAddress(AggregatorUtilitiesFactory, [], salt),
    ]);

    const fallbackExpander = await factoryViewer.connectIfDeployed(
      FallbackExpanderFactory,
      [
        blsPublicKeyRegistryAddress,
        addressRegistryAddress,
        aggregatorUtilitiesAddress,
      ],
      salt,
    );

    if (!fallbackExpander) {
      return undefined;
    }

    return await FallbackCompressor.wrap(fallbackExpander);
  }

  async compress(blsPublicKey: PublicKey, operation: Operation) {
    const result: string[] = [];

    const resultIndexForRegUsageBitStream = result.length;
    const bitStream: boolean[] = [];
    result.push("0x"); // Placeholder to overwrite

    const blsPublicKeyId = await this.blsPublicKeyRegistry.reverseLookup(
      blsPublicKey,
    );

    if (blsPublicKeyId === undefined) {
      bitStream.push(false);

      result.push(
        ethers.utils.defaultAbiCoder.encode(["uint256[4]"], [blsPublicKey]),
      );
    } else {
      bitStream.push(true);
      result.push(encodeRegIndex(blsPublicKeyId));
    }

    result.push(encodeVLQ(operation.nonce));
    result.push(encodePseudoFloat(operation.gas));

    result.push(encodeVLQ(operation.actions.length));

    const lastAction = operation.actions.at(-1);
    let txOriginPaymentAction: ActionData | undefined;

    let regularActions: ActionData[];

    if (
      lastAction !== undefined &&
      lastAction.contractAddress === this.aggregatorUtilities.address &&
      ethers.utils.hexlify(lastAction.encodedFunction) ===
        this.aggregatorUtilities.interface.encodeFunctionData(
          "sendEthToTxOrigin",
        )
    ) {
      bitStream.push(true);
      txOriginPaymentAction = lastAction;
      regularActions = operation.actions.slice(0, -1);
    } else {
      bitStream.push(false);
      regularActions = operation.actions;
    }

    for (const action of regularActions) {
      result.push(encodePseudoFloat(action.ethValue));

      const addressId = await this.addressRegistry.reverseLookup(
        action.contractAddress,
      );

      if (addressId === undefined) {
        bitStream.push(false);
        result.push(action.contractAddress);
      } else {
        bitStream.push(true);
        result.push(encodeRegIndex(addressId));
      }

      const fnHex = ethers.utils.hexlify(action.encodedFunction);
      const fnLen = (fnHex.length - 2) / 2;

      result.push(encodeVLQ(fnLen));
      result.push(fnHex);
    }

    if (txOriginPaymentAction !== undefined) {
      result.push(encodePseudoFloat(txOriginPaymentAction.ethValue));
    }

    result[resultIndexForRegUsageBitStream] = encodeBitStream(bitStream);

    return hexJoin(result);
  }
}
