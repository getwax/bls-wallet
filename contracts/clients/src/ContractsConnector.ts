import { ethers } from "ethers";
import { SafeSingletonFactoryViewer } from "./SafeSingletonFactory";
import SignerOrProvider from "./helpers/SignerOrProvider";
import assert from "./helpers/assert";
import {
  AddressRegistry__factory as AddressRegistryFactory,
  AggregatorUtilities__factory as AggregatorUtilitiesFactory,
  BLSExpanderDelegator__factory as BLSExpanderDelegatorFactory,
  BLSExpander__factory as BLSExpanderFactory,
  BLSOpen__factory as BLSOpenFactory,
  BLSPublicKeyRegistry__factory as BLSPublicKeyRegistryFactory,
  BLSRegistration__factory as BLSRegistrationFactory,
  BNPairingPrecompileCostEstimator__factory as BNPairingPrecompileCostEstimatorFactory,
  ERC20Expander__factory as ERC20ExpanderFactory,
  FallbackExpander__factory as FallbackExpanderFactory,
  VerificationGateway__factory as VerificationGatewayFactory,
} from "../typechain-types";

export default class ContractsConnector {
  constructor(
    public factoryViewer: SafeSingletonFactoryViewer,
    public salt: ethers.utils.BytesLike = ethers.utils.solidityPack(
      ["uint256"],
      [0],
    ),
  ) {}

  static async create(signerOrProvider: SignerOrProvider) {
    let provider: ethers.providers.Provider;

    if ("getNetwork" in signerOrProvider) {
      provider = signerOrProvider;
    } else {
      assert(
        signerOrProvider.provider !== undefined,
        "When using a signer, it's required to have a provider",
      );

      provider = signerOrProvider.provider;
    }

    const chainId = (await provider.getNetwork()).chainId;

    const factoryViewer = new SafeSingletonFactoryViewer(
      signerOrProvider,
      chainId,
    );

    return new ContractsConnector(factoryViewer);
  }

  BNPairingPrecompileCostEstimator = once(async () =>
    this.factoryViewer.connectOrThrow(
      BNPairingPrecompileCostEstimatorFactory,
      [],
      this.salt,
    ),
  );

  BLSOpen = once(() =>
    this.factoryViewer.connectOrThrow(BLSOpenFactory, [], this.salt),
  );

  VerificationGateway = once(async () =>
    this.factoryViewer.connectOrThrow(
      VerificationGatewayFactory,
      [(await this.BLSOpen()).address],
      this.salt,
    ),
  );

  AggregatorUtilities = once(async () =>
    this.factoryViewer.connectOrThrow(
      AggregatorUtilitiesFactory,
      [],
      this.salt,
    ),
  );

  BLSExpander = once(async () =>
    this.factoryViewer.connectOrThrow(
      BLSExpanderFactory,
      [(await this.VerificationGateway()).address],
      this.salt,
    ),
  );

  BLSExpanderDelegator = once(async () =>
    this.factoryViewer.connectOrThrow(
      BLSExpanderDelegatorFactory,
      [(await this.VerificationGateway()).address],
      this.salt,
    ),
  );

  BLSPublicKeyRegistry = once(async () =>
    this.factoryViewer.connectOrThrow(
      BLSPublicKeyRegistryFactory,
      [],
      this.salt,
    ),
  );

  AddressRegistry = once(async () =>
    this.factoryViewer.connectOrThrow(AddressRegistryFactory, [], this.salt),
  );

  FallbackExpander = once(async () =>
    this.factoryViewer.connectOrThrow(
      FallbackExpanderFactory,
      await Promise.all([
        this.BLSPublicKeyRegistry().then((c) => c.address),
        this.AddressRegistry().then((c) => c.address),
        this.AggregatorUtilities().then((c) => c.address),
      ]),
      this.salt,
    ),
  );

  BLSRegistration = once(async () =>
    this.factoryViewer.connectOrThrow(
      BLSRegistrationFactory,
      await Promise.all([
        this.BLSPublicKeyRegistry().then((c) => c.address),
        this.AddressRegistry().then((c) => c.address),
        this.AggregatorUtilities().then((c) => c.address),
      ]),
      this.salt,
    ),
  );

  ERC20Expander = once(async () =>
    this.factoryViewer.connectOrThrow(
      ERC20ExpanderFactory,
      await Promise.all([
        this.BLSPublicKeyRegistry().then((c) => c.address),
        this.AddressRegistry().then((c) => c.address),
        this.AggregatorUtilities().then((c) => c.address),
      ]),
      this.salt,
    ),
  );
}

function once<T extends {}>(fn: () => T): () => T {
  let result: T | undefined;

  return () => {
    if (result === undefined) {
      result = fn();
      (fn as unknown as undefined) = undefined;
    }

    return result;
  };
}
