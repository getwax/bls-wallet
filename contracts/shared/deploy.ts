/* eslint-disable camelcase */

import { ethers } from "ethers";
import {
  AggregatorUtilities,
  AggregatorUtilities__factory,
  BLSExpander,
  BLSExpander__factory,
  BLSOpen,
  BLSOpen__factory,
  BLSWallet__factory,
  BNPairingPrecompileCostEstimator,
  BNPairingPrecompileCostEstimator__factory,
  ProxyAdminGenerator__factory,
  VerificationGateway,
  VerificationGateway__factory,
} from "../typechain-types";

import SafeSingletonFactory from "./SafeSingletonFactory";

export type Deployment = {
  singletonFactory: SafeSingletonFactory;
  precompileCostEstimator: BNPairingPrecompileCostEstimator;
  blsLibrary: BLSOpen;
  verificationGateway: VerificationGateway;
  blsExpander: BLSExpander;
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

  const blsWalletImpl = await singletonFactory.deploy(
    BLSWallet__factory,
    [],
    salt,
  );
  await (await blsWalletImpl.initialize(ethers.constants.AddressZero)).wait();

  const blsLibrary = await singletonFactory.deploy(BLSOpen__factory, [], salt);

  const proxyAdminGenerator = await singletonFactory.deploy(
    ProxyAdminGenerator__factory,
    [],
    salt,
  );

  const verificationGateway = await singletonFactory.deploy(
    VerificationGateway__factory,
    [blsLibrary.address, blsWalletImpl.address, proxyAdminGenerator.address],
    salt,
  );

  const blsExpander = await singletonFactory.deploy(
    BLSExpander__factory,
    [verificationGateway.address],
    salt,
  );

  const aggregatorUtilities = await singletonFactory.deploy(
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
    aggregatorUtilities,
  };
}
