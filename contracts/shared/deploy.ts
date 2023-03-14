/* eslint-disable camelcase */

import { ethers } from "ethers";
import {
  AggregatorUtilities,
  AggregatorUtilities__factory,
  BLSExpander,
  BLSExpanderDelegator,
  BLSExpanderDelegator__factory,
  BLSExpander__factory,
  BLSOpen,
  BLSOpen__factory,
  BNPairingPrecompileCostEstimator,
  BNPairingPrecompileCostEstimator__factory,
  FallbackExpander__factory,
  VerificationGateway,
  VerificationGateway__factory,
} from "../typechain-types";

import { SafeSingletonFactory } from "../clients/src";

export type Deployment = {
  singletonFactory: SafeSingletonFactory;
  precompileCostEstimator: BNPairingPrecompileCostEstimator;
  blsLibrary: BLSOpen;
  verificationGateway: VerificationGateway;
  blsExpander: BLSExpander;
  blsExpanderDelegator: BLSExpanderDelegator;
  aggregatorUtilities: AggregatorUtilities;
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

  const fallbackExpander = await singletonFactory.connectOrDeploy(
    FallbackExpander__factory,
    [],
    salt,
  );

  const existingExpander0 = await blsExpanderDelegator.expanders(0);

  if (existingExpander0 === ethers.constants.AddressZero) {
    await (
      await blsExpanderDelegator.registerExpander(0, fallbackExpander.address)
    ).wait();
  } else if (existingExpander0 !== fallbackExpander.address) {
    throw new Error("Existing expander at index 0 is not fallbackExpander");
  }

  const aggregatorUtilities = await singletonFactory.connectOrDeploy(
    AggregatorUtilities__factory,
    [],
    salt,
  );

  return {
    singletonFactory,
    precompileCostEstimator,
    blsLibrary,
    verificationGateway,
    blsExpander,
    blsExpanderDelegator,
    aggregatorUtilities,
  };
}
