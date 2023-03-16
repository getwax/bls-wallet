import { ethers } from "ethers";
import {
  AddressRegistry,
  AddressRegistry__factory as AddressRegistryFactory,
  AggregatorUtilities,
  AggregatorUtilities__factory as AggregatorUtilitiesFactory,
  BLSExpander,
  BLSExpanderDelegator,
  BLSExpanderDelegator__factory as BLSExpanderDelegatorFactory,
  BLSExpander__factory as BLSExpanderFactory,
  BLSOpen,
  BLSOpen__factory as BLSOpenFactory,
  BLSPublicKeyRegistry,
  BLSPublicKeyRegistry__factory as BLSPublicKeyRegistryFactory,
  BNPairingPrecompileCostEstimator,
  BNPairingPrecompileCostEstimator__factory as BNPairingPrecompileCostEstimatorFactory,
  FallbackExpander,
  FallbackExpander__factory as FallbackExpanderFactory,
  BLSRegistration__factory as BLSRegistrationFactory,
  VerificationGateway,
  VerificationGateway__factory as VerificationGatewayFactory,
  BLSRegistration,
} from "../typechain-types";

import { SafeSingletonFactory } from "../clients/src";
import receiptOf from "./helpers/receiptOf";

export type Deployment = {
  singletonFactory: SafeSingletonFactory;
  precompileCostEstimator: BNPairingPrecompileCostEstimator;
  blsLibrary: BLSOpen;
  verificationGateway: VerificationGateway;
  blsExpander: BLSExpander;
  fallbackExpander: FallbackExpander;
  blsPublicKeyRegistry: BLSPublicKeyRegistry;
  addressRegistry: AddressRegistry;
  blsExpanderDelegator: BLSExpanderDelegator;
  aggregatorUtilities: AggregatorUtilities;
  blsRegistration: BLSRegistration;
};

export default async function deploy(
  signer: ethers.Signer,
  salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
): Promise<Deployment> {
  const singletonFactory = await SafeSingletonFactory.init(signer);

  const precompileCostEstimator = await singletonFactory.connectOrDeploy(
    BNPairingPrecompileCostEstimatorFactory,
    [],
    salt,
  );

  await (await precompileCostEstimator.run()).wait();

  const blsLibrary = await singletonFactory.connectOrDeploy(
    BLSOpenFactory,
    [],
    salt,
  );

  const verificationGateway = await singletonFactory.connectOrDeploy(
    VerificationGatewayFactory,
    [blsLibrary.address],
    salt,
  );

  const aggregatorUtilities = await singletonFactory.connectOrDeploy(
    AggregatorUtilitiesFactory,
    [],
    salt,
  );

  const {
    blsExpander,
    fallbackExpander,
    blsPublicKeyRegistry,
    addressRegistry,
    blsExpanderDelegator,
    blsRegistration,
  } = await deployExpanders(
    singletonFactory,
    verificationGateway,
    aggregatorUtilities,
    salt,
  );

  return {
    singletonFactory,
    precompileCostEstimator,
    blsLibrary,
    verificationGateway,
    blsExpander,
    fallbackExpander,
    blsPublicKeyRegistry,
    addressRegistry,
    blsExpanderDelegator,
    aggregatorUtilities,
    blsRegistration,
  };
}

async function deployExpanders(
  singletonFactory: SafeSingletonFactory,
  verificationGateway: VerificationGateway,
  aggregatorUtilities: AggregatorUtilities,
  salt: ethers.utils.BytesLike = ethers.utils.solidityPack(["uint256"], [0]),
) {
  const blsExpander = await singletonFactory.connectOrDeploy(
    BLSExpanderFactory,
    [verificationGateway.address],
    salt,
  );

  const blsExpanderDelegator = await singletonFactory.connectOrDeploy(
    BLSExpanderDelegatorFactory,
    [verificationGateway.address],
    salt,
  );

  const blsPublicKeyRegistry = await singletonFactory.connectOrDeploy(
    BLSPublicKeyRegistryFactory,
    [],
    salt,
  );

  const addressRegistry = await singletonFactory.connectOrDeploy(
    AddressRegistryFactory,
    [],
    salt,
  );

  const fallbackExpander = await singletonFactory.connectOrDeploy(
    FallbackExpanderFactory,
    [
      blsPublicKeyRegistry.address,
      addressRegistry.address,
      aggregatorUtilities.address,
    ],
    salt,
  );

  const blsRegistration = await singletonFactory.connectOrDeploy(
    BLSRegistrationFactory,
    [
      blsPublicKeyRegistry.address,
      addressRegistry.address,
      aggregatorUtilities.address,
    ],
  );

  await registerExpanders(blsExpanderDelegator, [
    fallbackExpander.address,
    blsRegistration.address,
  ]);

  return {
    blsExpander,
    fallbackExpander,
    blsPublicKeyRegistry,
    addressRegistry,
    blsExpanderDelegator,
    blsRegistration,
  };
}

async function registerExpanders(
  blsExpanderDelegator: BLSExpanderDelegator,
  expanders: string[],
) {
  for (const [i, expander] of expanders.entries()) {
    const existingExpander = await blsExpanderDelegator.expanders(i);

    if (existingExpander === ethers.constants.AddressZero) {
      await receiptOf(blsExpanderDelegator.registerExpander(i, expander));
    } else if (existingExpander !== expanders[i]) {
      throw new Error(`Existing expander at index ${i} is not ${expander}`);
    }
  }
}
