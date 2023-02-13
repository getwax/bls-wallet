import Aggregator from "./Aggregator";
import BlsWalletWrapper from "./BlsWalletWrapper";
import BlsProvider from "./BlsProvider";
import BlsSigner from "./BlsSigner";

// eslint-disable-next-line camelcase
import { VerificationGateway__factory } from "../typechain-types/factories/contracts/VerificationGateway__factory";
import type { VerificationGateway } from "../typechain-types/contracts/VerificationGateway";

// eslint-disable-next-line camelcase
import { AggregatorUtilities__factory } from "../typechain-types/factories/contracts/AggregatorUtilities__factory";
import type { AggregatorUtilities } from "../typechain-types/contracts/AggregatorUtilities";

// eslint-disable-next-line camelcase
import { ERC20__factory } from "../typechain-types/factories/@openzeppelin/contracts/token/ERC20/ERC20__factory";
import type { ERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20/ERC20";

// eslint-disable-next-line camelcase
import { MockERC20__factory } from "../typechain-types/factories/contracts/mock/MockERC20__factory";
import type { MockERC20 } from "../typechain-types/contracts/mock/MockERC20";

import { NetworkConfig, getConfig, validateConfig } from "./NetworkConfig";
import {
  MultiNetworkConfig,
  getMultiConfig,
  validateMultiConfig,
} from "./MultiNetworkConfig";

import {
  OperationResult,
  getOperationResults,
  decodeError,
  OperationResultError,
} from "./OperationResults";
import { BlsWalletContracts, connectToContracts } from "./BlsWalletContracts";

export * from "./signer";

const Experimental_ = {
  BlsProvider,
  BlsSigner,
};

/**
 * The Experimental namespace exposes APIs that are unstable.
 * Unstable in the sense that the APIs will be less functional, less well-tested, and/or are expected to change.
 */
namespace Experimental {
  export const BlsProvider = Experimental_.BlsProvider;
  export const BlsSigner = Experimental_.BlsSigner;
}

export {
  Aggregator,
  BlsWalletWrapper,
  NetworkConfig,
  getConfig,
  validateConfig,
  MultiNetworkConfig,
  getMultiConfig,
  validateMultiConfig,
  OperationResult,
  OperationResultError,
  getOperationResults,
  decodeError,
  // eslint-disable-next-line camelcase
  VerificationGateway__factory,
  VerificationGateway,
  // eslint-disable-next-line camelcase
  AggregatorUtilities__factory,
  AggregatorUtilities,
  // eslint-disable-next-line camelcase
  ERC20__factory,
  ERC20,
  // eslint-disable-next-line camelcase
  MockERC20__factory,
  MockERC20,
  BlsWalletContracts,
  connectToContracts,
  Experimental,
};
