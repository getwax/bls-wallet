import { BigNumber, ContractReceipt, utils } from "ethers";
import { ActionData } from "./signer";

type OperationResultError = {
  actionIndex: BigNumber;
  message: string;
};

export type OperationResult = {
  walletAddress: string;
  nonce: BigNumber;
  actions: ActionData[];
  success: Boolean;
  results: string[];
  error?: OperationResultError;
};

const getError = (
  success: boolean,
  results: string[],
): OperationResultError | undefined => {
  if (success) {
    return undefined;
  }

  // Single event "WalletOperationProcessed(address indexed wallet, uint256 nonce, bool success, bytes[] results)"
  // Get the first (only) result from "results" argument.
  const [errorResult] = results;
  // remove methodId (4bytes after 0x)
  const errorArgBytesString = `0x${errorResult.substring(10)}`;
  const errorString = utils.defaultAbiCoder.decode(
    ["string"],
    errorArgBytesString,
  )[0]; // decoded bytes is a string of the action index that errored.

  const splitErrorString = errorString.split(" - ");
  if (splitErrorString.length !== 2) {
    throw new Error("unexpected error message format");
  }

  return {
    actionIndex: BigNumber.from(splitErrorString[0]),
    message: splitErrorString[1],
  };
};

export const getOperationResults = (
  txnReceipt: ContractReceipt,
): OperationResult[] => {
  if (!txnReceipt.events || !txnReceipt.events.length) {
    throw new Error(
      `no events found in transaction ${txnReceipt.transactionHash}`,
    );
  }

  const walletOpProcessedEvents = txnReceipt.events.filter(
    (e) => e.event === "WalletOperationProcessed",
  );
  if (!walletOpProcessedEvents.length) {
    throw new Error(
      `no WalletOperationProcessed events found in transaction ${txnReceipt.transactionHash}`,
    );
  }

  return walletOpProcessedEvents.reduce<OperationResult[]>(
    (opResults, { args }) => {
      if (!args) {
        throw new Error("WalletOperationProcessed event missing args");
      }
      const { wallet, nonce, actions: rawActions, success, results } = args;

      const actions = rawActions.map(
        ({
          ethValue,
          contractAddress,
          encodedFunction,
        }: {
          ethValue: BigNumber;
          contractAddress: string;
          encodedFunction: string;
        }) => ({
          ethValue,
          contractAddress,
          encodedFunction,
        }),
      );
      const error = getError(success, results);

      return [
        ...opResults,
        {
          walletAddress: wallet,
          nonce,
          actions,
          success,
          results,
          error,
        },
      ];
    },
    [],
  );
};
