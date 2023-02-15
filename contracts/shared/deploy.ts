/* eslint-disable camelcase */

import { ethers } from "ethers";
import {
  AggregatorUtilities,
  AggregatorUtilities__factory,
  BLSExpander,
  BLSExpanderDelegator,
  BLSExpanderDelegator__factory,
  BLSExpander__factory,
  BNPairingPrecompileCostEstimator,
  BNPairingPrecompileCostEstimator__factory,
  FallbackExpander__factory,
  VerificationGateway,
  VerificationGateway__factory,
} from "../typechain-types";

import SafeSingletonFactory from "./SafeSingletonFactory";

export type Deployment = {
  singletonFactory: SafeSingletonFactory;
  precompileCostEstimator: BNPairingPrecompileCostEstimator;
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

  const precompileCostEstimator = await singletonFactory.deploy(
    BNPairingPrecompileCostEstimator__factory,
    [],
    salt,
  );

  await (await precompileCostEstimator.run()).wait();

  const verificationGateway = await singletonFactory.deploy(
    VerificationGateway__factory,
    [],
    salt,
  );

  const blsExpander = await singletonFactory.deploy(
    BLSExpander__factory,
    [verificationGateway.address],
    salt,
  );

  const blsExpanderDelegator = await singletonFactory.deploy(
    BLSExpanderDelegator__factory,
    [verificationGateway.address],
    salt,
  );

  const fallbackExpander = await singletonFactory.deploy(
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

  const aggregatorUtilities = await singletonFactory.deploy(
    AggregatorUtilities__factory,
    [],
    salt,
  );

  return {
    singletonFactory,
    precompileCostEstimator,
    verificationGateway,
    blsExpander,
    blsExpanderDelegator,
    aggregatorUtilities,
  };
}
