import { expect } from "chai";
import { BigNumber, ContractReceipt, utils } from "ethers";
import {
  decodeError,
  getOperationResults,
  errorSelectors,
} from "../src/OperationResults";

const encodeErrorResultFromEncodedMessage = (
  actionIndex: number,
  actionErrorSelector: string,
  encodedMessage: string,
): string => {
  const actionErrorData = `${actionErrorSelector}${encodedMessage.slice(2)}`; // remove 0x
  const encodedErrorMessage = utils.defaultAbiCoder.encode(
    ["uint256", "bytes"],
    [actionIndex, actionErrorData],
  );
  return `${errorSelectors.ActionError}${encodedErrorMessage.slice(2)}`; // remove 0x
};

const encodeErrorResult = (
  actionIndex: number,
  actionErrorSelector: string,
  message: string,
): string => {
  const encodedMessage = utils.defaultAbiCoder.encode(["string"], [message]);
  return encodeErrorResultFromEncodedMessage(
    actionIndex,
    actionErrorSelector,
    encodedMessage,
  );
};

describe("OperationResults", () => {
  describe("decodeError", () => {
    it("fails if error data does not start with ActionError selector", () => {
      const errorData = "does not compute";
      expect(() => decodeError(errorData)).to.throw(
        `errorResult does not begin with ActionError selector (${errorSelectors.ActionError}): ${errorData}`,
      );
    });

    it("parses error data", () => {
      const actionIndex = 43770;
      const msg = "hello";
      const errorData = encodeErrorResult(
        actionIndex,
        errorSelectors.Error,
        msg,
      );

      const { actionIndex: actionIdxBn, message } = decodeError(errorData);
      expect(actionIdxBn?.toNumber()).to.eql(actionIndex);
      expect(message).to.eql(msg);
    });

    it("parses panic error data", () => {
      const actionIndex = 1337;
      const panicCode = BigNumber.from(42);
      const panicActionErrorData = utils.defaultAbiCoder.encode(
        ["uint256"],
        [panicCode],
      );
      const errorData = encodeErrorResultFromEncodedMessage(
        actionIndex,
        errorSelectors.Panic,
        panicActionErrorData,
      );

      const { actionIndex: actionIdxBn, message } = decodeError(errorData);
      expect(actionIdxBn?.toNumber()).to.eql(actionIndex);
      expect(message).to.eql(
        `Panic: ${panicCode.toHexString()} (See Panic(uint256) in the solidity docs: https://docs.soliditylang.org/_/downloads/en/latest/pdf/)`,
      );
    });

    it("handles unexpected error data", () => {
      const actionIndex = 707;
      const msg = "lol";
      const errorData = encodeErrorResult(
        actionIndex,
        errorSelectors.ActionError,
        msg,
      );
      const encodedMessage = utils.defaultAbiCoder.encode(["string"], [msg]);
      const actionErrorData = `${
        errorSelectors.ActionError
      }${encodedMessage.slice(2)}`; // remove 0x

      const { actionIndex: actionIdxBn, message } = decodeError(errorData);
      expect(actionIdxBn?.toNumber()).to.eql(actionIndex);
      expect(message).to.eql(
        `Unexpected action error data: ${actionErrorData}`,
      );
    });

    it("handles exceptions when parsing error data", () => {
      const encodedErrorMessage = utils.defaultAbiCoder.encode(
        ["uint256"],
        [0],
      );
      const errorData = `${
        errorSelectors.ActionError
      }${encodedErrorMessage.slice(2)}`; // Remove 0x

      expect(decodeError(errorData)).to.deep.equal({
        actionIndex: undefined,
        message: `Unexpected error data: ${errorData}`,
      });
    });
  });

  describe("getOperationResults", () => {
    it("fails if no events are in transaction", () => {
      const txnReceipt = {
        transactionHash: "0x111111",
      } as ContractReceipt;

      expect(() => getOperationResults(txnReceipt)).to.throw(
        `no WalletOperationProcessed events found in transaction ${txnReceipt.transactionHash}`,
      );
    });

    it("fails if no WalletOperationProcessed events are in transaction", () => {
      const event = { event: "Other" };
      const txnReceipt = {
        transactionHash: "0x123456",
        events: [event],
      } as ContractReceipt;

      expect(() => getOperationResults(txnReceipt)).to.throw(
        `no WalletOperationProcessed events found in transaction ${txnReceipt.transactionHash}`,
      );
    });

    it("fails when WalletOperationProcessed event is missing args", () => {
      const event = { event: "WalletOperationProcessed" };
      const txnReceipt = {
        events: [event],
      } as ContractReceipt;

      expect(() => getOperationResults(txnReceipt)).to.throw(
        "WalletOperationProcessed event missing args",
      );
    });

    it("decodes WalletOperationProcessed events", () => {
      const otherEvent = { event: "Other" };

      const errorActionIndex = 0;
      const errorMessage = "halt and catch fire";
      const errorResult = encodeErrorResult(
        errorActionIndex,
        errorSelectors.Error,
        errorMessage,
      );

      const failedEvent = {
        event: "WalletOperationProcessed",
        args: {
          wallet: "0x01",
          nonce: BigNumber.from(0),
          actions: [
            {
              ethValue: BigNumber.from(0),
              contractAddress: "0xaabbcc",
              encodedFunction: "0xddeeff",
            },
          ],
          success: false,
          results: [errorResult],
        },
      };

      const successfulEvent = {
        event: "WalletOperationProcessed",
        args: {
          wallet: "0x02",
          nonce: BigNumber.from(1),
          actions: [
            {
              ethValue: BigNumber.from(0),
              contractAddress: "0xabcabc",
              encodedFunction: "0xdefdef",
            },
            {
              ethValue: BigNumber.from(42),
              contractAddress: "0x123123",
              encodedFunction: "0x456456",
            },
          ],
          success: true,
          results: ["0x2A", "0x539"],
        },
      };

      const txnReceipt = {
        events: [otherEvent, failedEvent, successfulEvent],
      } as ContractReceipt;

      const opResults = getOperationResults(txnReceipt);
      expect(opResults).to.have.lengthOf(2);

      const [r1, r2] = opResults;
      expect(r1.walletAddress).to.eql(failedEvent.args.wallet);
      expect(r1.nonce.toNumber()).to.eql(
        BigNumber.from(failedEvent.args.nonce).toNumber(),
      );
      expect(r1.actions).to.deep.equal(failedEvent.args.actions);
      expect(r1.success).to.eql(failedEvent.args.success);
      expect(r1.results).to.deep.equal(failedEvent.args.results);
      expect(r1.error?.actionIndex?.toNumber()).to.eql(errorActionIndex);
      expect(r1.error?.message).to.eql(errorMessage);

      expect(r2.walletAddress).to.eql(successfulEvent.args.wallet);
      expect(r2.nonce.toNumber()).to.eql(
        BigNumber.from(successfulEvent.args.nonce).toNumber(),
      );
      expect(r2.actions).to.deep.equal(successfulEvent.args.actions);
      expect(r2.success).to.eql(successfulEvent.args.success);
      expect(r2.results).to.deep.equal(successfulEvent.args.results);
      expect(r2.error).to.eql(undefined);
    });
  });
});
