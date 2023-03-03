import { providers } from "ethers";
import {
  VerificationGateway,
  VerificationGateway__factory as VerificationGatewayFactory,
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
  const [verificationGateway, blsExpander, aggregatorUtilities, testToken] =
    await Promise.all([
      VerificationGatewayFactory.connect(
        addresses.verificationGateway,
        provider,
      ),
      BLSExpanderFactory.connect(addresses.blsExpander, provider),
      AggregatorUtilitiesFactory.connect(addresses.utilities, provider),
      MockERC20Factory.connect(addresses.testToken, provider),
    ]);

  return {
    verificationGateway,
    blsExpander,
    aggregatorUtilities,
    testToken,
  };
};
