import { BigNumberish } from 'ethers';
import { SendTransactionParams } from './Network/createEthMiddleware';

const knownTransactions: Record<
  string,
  SendTransactionParams & {
    nonce: string;
    value: BigNumberish;
  }
> = {};

// TODO: This is used to facilitate mocking eth_getTransactionByHash. If we
// proceed with this approach this should be rolled into the application
// properly instead of being stored globally.
export default knownTransactions;
