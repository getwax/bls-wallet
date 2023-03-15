/* eslint-disable camelcase */

import { ethers } from "ethers";
import {
  AddressRegistry,
  AddressRegistry__factory,
  AggregatorUtilities,
  AggregatorUtilities__factory,
  BLSExpander,
  BLSExpanderDelegator,
  BLSExpanderDelegator__factory,
  BLSExpander__factory,
  BLSOpen,
  BLSOpen__factory,
  BLSPublicKeyRegistry,
  BLSPublicKeyRegistry__factory,
  BNPairingPrecompileCostEstimator,
  BNPairingPrecompileCostEstimator__factory,
  FallbackExpander,
  FallbackExpander__factory,
  BLSRegistration__factory,
  VerificationGateway,
  VerificationGateway__factory,
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
    BNPairingPrecompileCostEstimator__factory,
    [],
    salt,
  );

  await (await precompileCostEstimator.run()).wait();

  const blsLibrary = await singletonFactory.connectOrDeploy(
    BLSOpen__factory,
    [],
    salt,
  );

  const verificationGateway = await singletonFactory.connectOrDeploy(
    VerificationGateway__factory,
    [blsLibrary.address],
    salt,
  );

  const aggregatorUtilities = await singletonFactory.connectOrDeploy(
    AggregatorUtilities__factory,
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
    BLSExpander__factory,
    [verificationGateway.address],
    salt,
  );

  const blsExpanderDelegator = await singletonFactory.connectOrDeploy(
    BLSExpanderDelegator__factory,
    [verificationGateway.address],
    salt,
  );

  const blsPublicKeyRegistry = await singletonFactory.connectOrDeploy(
    BLSPublicKeyRegistry__factory,
    [],
    salt,
  );

  const addressRegistry = await singletonFactory.connectOrDeploy(
    AddressRegistry__factory,
    [],
    salt,
  );

  const fallbackExpander = await singletonFactory.connectOrDeploy(
    FallbackExpander__factory,
    [blsPublicKeyRegistry.address, addressRegistry.address],
    salt,
  );

  const blsRegistration = await singletonFactory.connectOrDeploy(
    BLSRegistration__factory,
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
