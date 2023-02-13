import { providers } from "ethers";
import {
  VerificationGateway,
  VerificationGateway__factory as VerificationGatewayFactory,
  BLSOpen,
  BLSOpen__factory as BLSOpenFactory,
  BLSExpander,
  BLSExpander__factory as BLSExpanderFactory,
  AggregatorUtilities,
  AggregatorUtilities__factory as AggregatorUtilitiesFactory,
  MockERC20,
  MockERC20__factory as MockERC20Factory,
} from "../typechain-types";
import { NetworkConfig } from "./NetworkConfig";

/**
 * BLS Wallet Contracts
 */
export type BlsWalletContracts = Readonly<{
  verificationGateway: VerificationGateway;
  blsLibrary: BLSOpen;
  blsExpander: BLSExpander;
  aggregatorUtilities: AggregatorUtilities;
  testToken: MockERC20;
}>;

/**
 * Connects to all deployed BLS Wallet contracts using a Network Config
 *
 * @param provider ether.js provider
 * @param networkConfig NetworkConfig containing contract dpeloyment information
 * @returns BLS Wallet contracts connected to provider
 */
export const connectToContracts = async (
  provider: providers.Provider,
  { addresses }: NetworkConfig,
): Promise<BlsWalletContracts> => {
  const [
    verificationGateway,
    blsLibrary,
    blsExpander,
    aggregatorUtilities,
    testToken,
  ] = await Promise.all([
    VerificationGatewayFactory.connect(addresses.verificationGateway, provider),
    BLSOpenFactory.connect(addresses.blsLibrary, provider),
    BLSExpanderFactory.connect(addresses.blsExpander, provider),
    AggregatorUtilitiesFactory.connect(addresses.utilities, provider),
    MockERC20Factory.connect(addresses.testToken, provider),
  ]);

  return {
    verificationGateway,
    blsLibrary,
    blsExpander,
    aggregatorUtilities,
    testToken,
  };
};
