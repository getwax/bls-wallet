import { TransactionFactory, TxData } from "@ethereumjs/tx";
import { BigNumber, ContractTransaction, Signer /*, utils */ } from "ethers";
import {
  BlsWalletSigner,
  Bundle,
  getOperationResults,
} from "../../clients/src";
import { VerificationGateway } from "../../typechain-types";

export const getTransactionSizeBytes = (rawTxnData: string): number => {
  /**
   * txn.data is a DataHexstring (https://docs.ethers.io/v5/api/utils/bytes/#DataHexString)
   * so can assume if will be even in length.
   *
   * One hex character = 4 bits (nibble)
   * so every 2 will be 1 byte.
   */
  const hexIdentifierLen = 2; // 0x
  const hexCharPerByte = 2;
  return (rawTxnData.length - hexIdentifierLen) / hexCharPerByte;
};

export const sumTransactionSizesBytes = (rawTxnsData: string[]): number => {
  return rawTxnsData.reduce(
    (total, rawTxn) => total + getTransactionSizeBytes(rawTxn),
    0,
  );
};

// https://docs.ethers.io/v5/cookbook/transactions/#cookbook--compute-raw-transaction
// Consider using this instead of @ethereumjs/tx once https://github.com/ethers-io/ethers.js/issues/3492 is resolved.
// export const getRawTransaction = (txn: ContractTransaction): string => {
//   const addKey = (accum, key) => {
//     if (key in txn) {
//       accum[key] = txn[key];
//     }
//     return accum;
//   };

//   // Extract the relevant parts of the transaction and signature
//   // NOTE: This is for EIP-1559 transactions
//   const txFields =
//     "accessList chainId data gasLimit maxFeePerGas maxPriorityFeePerGas nonce to type value".split(
//       " ",
//     );
//   const sigFields = "v r s".split(" ");

//   // Serialize the signed transaction
//   const raw = utils.serializeTransaction(
//     txFields.reduce(addKey, {}),
//     sigFields.reduce(addKey, {}),
//   );

//   // Double check things went well
//   if (utils.keccak256(raw) !== txn.hash) {
//     throw new Error("serializing trasnsaction failed");
//   }
//   return raw;
// };

const convertEthersTxnToEthereumJs = (txn: ContractTransaction): TxData => {
  return Object.entries(txn).reduce((acc, [k, v]) => {
    if (BigNumber.isBigNumber(v)) {
      v = v.toHexString();
    }
    return {
      ...acc,
      [k]: v,
    };
  }, {});
};

export const getRawTransaction = (txn: ContractTransaction): string => {
  const ethJsTxn = convertEthersTxnToEthereumJs(txn);
  const rawTxnHex = TransactionFactory.fromTxData(ethJsTxn)
    .serialize()
    .toString("hex");
  return `0x${rawTxnHex}`;
};

export const getManyRawTransactions = (
  txns: ContractTransaction[],
): string[] => {
  return txns.map((t) => getRawTransaction(t));
};

export const processBundles = async (
  verificationGateway: VerificationGateway,
  eoaSigner: Signer,
  blsSigner: BlsWalletSigner,
  bundles: Bundle[],
): Promise<void> => {
  const aggBundle = blsSigner.aggregate(bundles);

  const txn = await verificationGateway
    .connect(eoaSigner)
    .processBundle(aggBundle);
  const txnReceipt = await txn.wait();
  const results = getOperationResults(txnReceipt);

  const errors = results
    .filter((r) => r.error)
    .map(
      ({ error: err }, i) =>
        `operation ${i}, action ${err.actionIndex}: ${err.message}`,
    );
  if (errors.length) {
    throw new Error(
      `VerificationGateway.processBundle returned errors: [${errors.join(
        ", ",
      )}]`,
    );
  }
};
