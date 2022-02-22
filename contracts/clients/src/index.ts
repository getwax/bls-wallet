import Aggregator from "./Aggregator";
import BlsWalletWrapper from "./BlsWalletWrapper";

// eslint-disable-next-line camelcase
import { VerificationGateway__factory } from "../typechain/factories/VerificationGateway__factory";
import type { VerificationGateway } from "../typechain/VerificationGateway";

// eslint-disable-next-line camelcase
import { AggregatorUtilities__factory } from "../typechain/factories/AggregatorUtilities__factory";
import type { AggregatorUtilities } from "../typechain/AggregatorUtilities";

// eslint-disable-next-line camelcase
import { ERC20__factory } from "../typechain/factories/ERC20__factory";
import type { ERC20 } from "../typechain/ERC20";

// eslint-disable-next-line camelcase
import { MockERC20__factory } from "../typechain/factories/MockERC20__factory";
import type { MockERC20 } from "../typechain/MockERC20";

import { NetworkConfig, getConfig, validateConfig } from "./NetworkConfig";

export * from "./signer";

export {
  Aggregator,
  BlsWalletWrapper,
  NetworkConfig,
  getConfig,
  validateConfig,
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
};
