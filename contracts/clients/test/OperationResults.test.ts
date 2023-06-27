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

    it("decodes WalletOperationProcessed logs", () => {
      const receipt = {
        // Sometimes you get .events but WalletOperationProcessed are not
        // decoded, this helps cover that case.
        // Eg: calling blsExpanderDelegator.run
        events: [] as unknown[],

        logs: [
          // Unrelated log
          {
            transactionIndex: 0,
            blockNumber: 28,
            transactionHash:
              "0x34385907a3bfb358cefdecd12071f12617a8f81d3a7c37ab52b7444f56856728",
            address: "0x00f8CC7Bb32B7ee91c346640D203DdC57204a977",
            topics: [
              "0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b",
              "0x000000000000000000000000e619cf09e1f0eb1f9172431ec49dbef4747f8fe7",
            ],
            data: "0x",
            logIndex: 0,
            blockHash:
              "0x728208c8902b362abc7c6c7496e41d9a4825204788125d7e76038775851fc27e",
          },

          // WalletOperationProcessed for successful transfer
          {
            transactionIndex: 0,
            blockNumber: 28,
            transactionHash:
              "0x34385907a3bfb358cefdecd12071f12617a8f81d3a7c37ab52b7444f56856728",
            address: "0xE25229F29BAD62B1198F05F32169B70a9edc84b8",
            topics: [
              "0x9872451083cef0fc4232916d3eef8f2267edb3d496db39434a0d3142a27df456",
              "0x00000000000000000000000000f8cc7bb32b7ee91c346640d203ddc57204a977",
            ],
            data: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000016345785d8a0000000000000000000000000000e9d90fb095c18ce6dd2acee68684503b7837ed4200000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000",
            logIndex: 4,
            blockHash:
              "0x728208c8902b362abc7c6c7496e41d9a4825204788125d7e76038775851fc27e",
          },

          // WalletOperationProcessed for failing transfer (insufficient funds)
          {
            transactionIndex: 0,
            blockNumber: 28,
            transactionHash:
              "0x34385907a3bfb358cefdecd12071f12617a8f81d3a7c37ab52b7444f56856728",
            address: "0xE25229F29BAD62B1198F05F32169B70a9edc84b8",
            topics: [
              "0x9872451083cef0fc4232916d3eef8f2267edb3d496db39434a0d3142a27df456",
              "0x000000000000000000000000e9d90fb095c18ce6dd2acee68684503b7837ed42",
            ],
            data: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000001bc16d674ec800000000000000000000000000007c7cace58eccaac75021a2da4f5fc5cdc095e411000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000645c66760100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
            logIndex: 9,
            blockHash:
              "0x728208c8902b362abc7c6c7496e41d9a4825204788125d7e76038775851fc27e",
          },

          // WalletOperationProcessed for successful transfer
          {
            transactionIndex: 0,
            blockNumber: 28,
            transactionHash:
              "0x34385907a3bfb358cefdecd12071f12617a8f81d3a7c37ab52b7444f56856728",
            address: "0xE25229F29BAD62B1198F05F32169B70a9edc84b8",
            topics: [
              "0x9872451083cef0fc4232916d3eef8f2267edb3d496db39434a0d3142a27df456",
              "0x0000000000000000000000007c7cace58eccaac75021a2da4f5fc5cdc095e411",
            ],
            data: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000429d069189e000000000000000000000000000000f8cc7bb32b7ee91c346640d203ddc57204a97700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000",
            logIndex: 14,
            blockHash:
              "0x728208c8902b362abc7c6c7496e41d9a4825204788125d7e76038775851fc27e",
          },
        ],
      } as ContractReceipt;

      const results = getOperationResults(receipt);

      // Helps to smooth out oddities like `error: undefined` which we don't
      // care about
      const normalizedResults = JSON.parse(JSON.stringify(results));

      expect(normalizedResults).to.deep.eq([
        {
          walletAddress: "0x00f8CC7Bb32B7ee91c346640D203DdC57204a977",
          nonce: {
            type: "BigNumber",
            hex: "0x00",
          },
          actions: [
            {
              ethValue: {
                type: "BigNumber",
                hex: "0x016345785d8a0000",
              },
              contractAddress: "0xE9d90fB095c18ce6Dd2AcEe68684503b7837eD42",
              encodedFunction: "0x",
            },
          ],
          success: true,
          results: ["0x"],
        },
        {
          walletAddress: "0xE9d90fB095c18ce6Dd2AcEe68684503b7837eD42",
          nonce: {
            type: "BigNumber",
            hex: "0x00",
          },
          actions: [
            {
              ethValue: {
                type: "BigNumber",
                hex: "0x1bc16d674ec80000",
              },
              contractAddress: "0x7c7CAce58eCCAac75021a2dA4F5fc5cDc095E411",
              encodedFunction: "0x",
            },
          ],
          success: false,
          results: [
            "0x5c667601000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000",
          ],
          error: {
            actionIndex: {
              type: "BigNumber",
              hex: "0x00",
            },
            message: "Unexpected action error data: 0x",
          },
        },
        {
          walletAddress: "0x7c7CAce58eCCAac75021a2dA4F5fc5cDc095E411",
          nonce: {
            type: "BigNumber",
            hex: "0x00",
          },
          actions: [
            {
              ethValue: {
                type: "BigNumber",
                hex: "0x0429d069189e0000",
              },
              contractAddress: "0x00f8CC7Bb32B7ee91c346640D203DdC57204a977",
              encodedFunction: "0x",
            },
          ],
          success: true,
          results: ["0x"],
        },
      ]);
    });
  });
});
