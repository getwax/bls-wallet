import { BigNumber, ethers, Signer } from "ethers";
import {
  AddressRegistry__factory as AddressRegistryFactory,
  AggregatorUtilities,
  AggregatorUtilities__factory as AggregatorUtilitiesFactory,
  BLSPublicKeyRegistry__factory as BLSPublicKeyRegistryFactory,
  BLSRegistration,
  BLSRegistration__factory as BLSRegistrationFactory,
} from "../typechain-types";
import AddressRegistryWrapper from "./AddressRegistryWrapper";
import BlsPublicKeyRegistryWrapper from "./BlsPublicKeyRegistryWrapper";
import { encodePseudoFloat, encodeVLQ, hexJoin } from "./encodeUtils";
import SignerOrProvider from "./helpers/SignerOrProvider";
import IOperationCompressor from "./IOperationCompressor";
import SafeSingletonFactory, {
  SafeSingletonFactoryViewer,
} from "./SafeSingletonFactory";
import { Operation, PublicKey } from "./signer/types";

export default class BlsRegistrationCompressor implements IOperationCompressor {
  private constructor(
    public blsRegistration: BLSRegistration,
    public blsPublicKeyRegistry: BlsPublicKeyRegistryWrapper,
    public addressRegistry: AddressRegistryWrapper,
    public aggregatorUtilities: AggregatorUtilities,
  ) {}

  static async wrap(
    blsRegistration: BLSRegistration,
  ): Promise<BlsRegistrationCompressor> {
    const [
      blsPublicKeyRegistryAddress,
      addressRegistryAddress,
      aggregatorUtilitiesAddress,
    ] = await Promise.all([
      blsRegistration.blsPublicKeyRegistry(),
      blsRegistration.addressRegistry(),
      blsRegistration.aggregatorUtilities(),
    ]);

    return new BlsRegistrationCompressor(
      blsRegistration,
      new BlsPublicKeyRegistryWrapper(
        BLSPublicKeyRegistryFactory.connect(
          blsPublicKeyRegistryAddress,
          blsRegistration.signer,
        ),
      ),
      new AddressRegistryWrapper(
        AddressRegistryFactory.connect(
          addressRegistryAddress,
          blsRegistration.signer,
        ),
      ),
      AggregatorUtilitiesFactory.connect(
        aggregatorUtilitiesAddress,
        blsRegistration.signer,
      ),
    );
  }

  static async deployNew(signer: Signer): Promise<BlsRegistrationCompressor> {
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

    const blsRegistrationFactory = new BLSRegistrationFactory(signer);

    const blsRegistrationContract = await blsRegistrationFactory.deploy(
      blsPublicKeyRegistryContract.address,
      addressRegistryContract.address,
      aggregatorUtilitiesContract.address,
    );

    return new BlsRegistrationCompressor(
      blsRegistrationContract,
      new BlsPublicKeyRegistryWrapper(blsPublicKeyRegistryContract),
      new AddressRegistryWrapper(addressRegistryContract),
      aggregatorUtilitiesContract,
    );
  }

  static async connectOrDeploy(
    signerOrFactory: Signer | SafeSingletonFactory,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<BlsRegistrationCompressor> {
    const factory = await SafeSingletonFactory.from(signerOrFactory);

    const [blsPublicKeyRegistry, addressRegistry, aggregatorUtilities] =
      await Promise.all([
        BlsPublicKeyRegistryWrapper.connectOrDeploy(factory, salt),
        AddressRegistryWrapper.connectOrDeploy(factory, salt),
        factory.connectOrDeploy(AggregatorUtilitiesFactory, [], salt),
      ]);

    const blsRegistrationContract = await factory.connectOrDeploy(
      BLSRegistrationFactory,
      [
        blsPublicKeyRegistry.registry.address,
        addressRegistry.registry.address,
        aggregatorUtilities.address,
      ],
      salt,
    );

    return new BlsRegistrationCompressor(
      blsRegistrationContract,
      blsPublicKeyRegistry,
      addressRegistry,
      aggregatorUtilities,
    );
  }

  static async connectIfDeployed(
    signerOrProvider: SignerOrProvider,
    salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
  ): Promise<BlsRegistrationCompressor | undefined> {
    const factoryViewer = await SafeSingletonFactoryViewer.from(
      signerOrProvider,
    );

    const blsPublicKeyRegistryAddress = factoryViewer.calculateAddress(
      BLSPublicKeyRegistryFactory,
      [],
      salt,
    );

    const addressRegistryAddress = factoryViewer.calculateAddress(
      AddressRegistryFactory,
      [],
      salt,
    );

    const aggregatorUtilitiesAddress = factoryViewer.calculateAddress(
      AggregatorUtilitiesFactory,
      [],
      salt,
    );

    const blsRegistration = await factoryViewer.connectIfDeployed(
      BLSRegistrationFactory,
      [
        blsPublicKeyRegistryAddress,
        addressRegistryAddress,
        aggregatorUtilitiesAddress,
      ],
      salt,
    );

    if (!blsRegistration) {
      return undefined;
    }

    return await BlsRegistrationCompressor.wrap(blsRegistration);
  }

  getExpanderAddress(): string {
    return this.blsRegistration.address;
  }

  async compress(blsPublicKey: PublicKey, operation: Operation) {
    if (operation.actions.length > 2) {
      return undefined;
    }

    // Must be a non-paying call to blsRegistration.register with the user's
    // blsPublicKey
    const firstAction = operation.actions.at(0);

    if (
      firstAction === undefined ||
      !BigNumber.from(firstAction.ethValue).isZero() ||
      firstAction.contractAddress !== this.blsRegistration.address ||
      ethers.utils.hexlify(firstAction.encodedFunction) !==
        this.blsRegistration.interface.encodeFunctionData("register", [
          blsPublicKey,
        ])
    ) {
      return undefined;
    }

    // Must be absent or a non-zero payment to tx.origin
    const secondAction = operation.actions.at(1);

    if (secondAction !== undefined) {
      if (
        BigNumber.from(secondAction.ethValue).isZero() ||
        secondAction.contractAddress !== this.aggregatorUtilities.address ||
        ethers.utils.hexlify(secondAction.encodedFunction) !==
          this.aggregatorUtilities.interface.encodeFunctionData(
            "sendEthToTxOrigin",
          )
      ) {
        return undefined;
      }
    }

    return hexJoin([
      ethers.utils.defaultAbiCoder.encode(["uint256[4]"], [blsPublicKey]),
      encodeVLQ(operation.nonce),
      encodePseudoFloat(operation.gas),
      encodePseudoFloat(secondAction?.ethValue ?? 0),
    ]);
  }
}
