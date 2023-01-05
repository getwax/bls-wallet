import { BigNumber, ContractReceipt, utils } from "ethers";
import assert from "./helpers/assert";
import { ActionData } from "./signer";

export const errorSelectors = {
  Error: calculateAndCheckSelector("Error(string)", "0x08c379a0"),

  Panic: calculateAndCheckSelector("Panic(uint256)", "0x4e487b71"),

  ActionError: calculateAndCheckSelector(
    "ActionError(uint256,bytes)",
    "0x5c667601",
  ),
};

const actionErrorId = utils
  .keccak256(new TextEncoder().encode("ActionError(uint256,bytes)"))
  .slice(0, 10);

assert(actionErrorId === "0x5c667601");

export type OperationResultError = {
  actionIndex?: BigNumber;
  message: string;
};

export type OperationResult = {
  walletAddress: string;
  nonce: BigNumber;
  actions: ActionData[];
  success: boolean;
  results: string[];
  error?: OperationResultError;
};

/**
 * Checks if a operation result error string is valid and returns
 * the decoded error.
 *
 * @param errorData An error string returned by an operation result.
 */
export const decodeError = (errorData: string): OperationResultError => {
  if (!errorData.startsWith(errorSelectors.ActionError)) {
    throw new Error(
      [
        `errorResult does not begin with ActionError selector`,
        `(${errorSelectors.ActionError}): ${errorData}`,
      ].join(" "),
    );
  }

  // remove methodId (4bytes after 0x)
  const actionErrorArgBytes = `0x${errorData.slice(10)}`;

  let actionIndex: BigNumber | undefined;
  let message: string;

  try {
    const [actionIndexDecoded, actionErrorData] = utils.defaultAbiCoder.decode(
      ["uint256", "bytes"],
      actionErrorArgBytes,
    ) as [BigNumber, string];

    actionIndex = actionIndexDecoded;

    const actionErrorDataBody = `0x${actionErrorData.slice(10)}`;

    if (actionErrorData.startsWith(errorSelectors.Error)) {
      [message] = utils.defaultAbiCoder.decode(["string"], actionErrorDataBody);
    } else if (actionErrorData.startsWith(errorSelectors.Panic)) {
      const [panicCode] = utils.defaultAbiCoder.decode(
        ["uint256"],
        actionErrorDataBody,
      ) as [BigNumber];

      message = [
        `Panic: ${panicCode.toHexString()}`,
        "(See Panic(uint256) in the solidity docs:",
        "https://docs.soliditylang.org/_/downloads/en/latest/pdf/)",
      ].join(" ");
    } else {
      message = `Unexpected action error data: ${actionErrorData}`;
    }
  } catch (error) {
    console.error(error);
    message = `Unexpected error data: ${errorData}`;
  }

  return {
    actionIndex,
    message,
  };
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
  const [errorData] = results;

  return decodeError(errorData);
};

/**
 * Gets the results of operations (and actions) run through VerificationGateway.processBundle.
 * Decodes unsuccessful operations into an error message and the index of the action that failed.
 *
 * @param transactionReceipt Transaction receipt from a VerificationGateway.processBundle transaction
 * @returns An array of decoded operation results
 */
export const getOperationResults = (
  txnReceipt: ContractReceipt,
): OperationResult[] => {
  const walletOpProcessedEvents = txnReceipt.events?.filter(
    (e) => e.event === "WalletOperationProcessed",
  );
  if (!walletOpProcessedEvents?.length) {
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

function calculateSelector(signature: string) {
  return utils.keccak256(new TextEncoder().encode(signature)).slice(0, 10);
}

function calculateAndCheckSelector(signature: string, expected: string) {
  const selector = calculateSelector(signature);

  assert(
    selector === expected,
    `Selector for ${signature} was not ${expected}`,
  );

  return selector;
}
