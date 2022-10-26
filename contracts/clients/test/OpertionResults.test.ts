import { expect } from "chai";
import { BigNumber, ContractReceipt, Event, utils } from "ethers";
import * as TypeMoq from "typemoq";
import { getOperationResults } from "../src";

class MockResult extends Array<unknown> {
  [key: string]: unknown;

  constructor(obj: Record<string, unknown>) {
    super();
    for (const k in obj) {
      this[k] = obj[k];
    }
  }
}

const getErrorResult = (actionIndex: number, message: string): string => {
  const fullErrorMessage = `${actionIndex} - ${message}`;
  const encodedErrorMessage = utils.defaultAbiCoder.encode(
    ["string"],
    [fullErrorMessage],
  );
  // Add empty methodId (4 bytes, 8 chars), remove leading 0
  return `0x${"0".repeat(8)}${encodedErrorMessage.substring(2)}`;
};

describe("OperationResults", () => {
  describe("getOperationResults", () => {
    it("fails if no events are in transaction", () => {
      const hash = "0xabc123";
      const txnReceiptMock = TypeMoq.Mock.ofType<ContractReceipt>();
      txnReceiptMock.setup((r) => r.transactionHash).returns(() => hash);
      txnReceiptMock.setup((r) => r.events).returns(() => undefined);

      expect(() => getOperationResults(txnReceiptMock.object)).to.throw(
        `no events found in transaction ${hash}`,
      );
    });

    it("fails if events are empty in transaction", () => {
      const hash = "0xdef456";
      const txnReceiptMock = TypeMoq.Mock.ofType<ContractReceipt>();
      txnReceiptMock.setup((r) => r.transactionHash).returns(() => hash);
      txnReceiptMock.setup((r) => r.events).returns(() => []);

      expect(() => getOperationResults(txnReceiptMock.object)).to.throw(
        `no events found in transaction ${hash}`,
      );
    });

    it("fails if no WalletOperationProcessed events are in transaction", () => {
      const eventMock = TypeMoq.Mock.ofType<Event>();
      eventMock.setup((e) => e.event).returns(() => "Other");

      const hash = "0x123456";
      const txnReceiptMock = TypeMoq.Mock.ofType<ContractReceipt>();
      txnReceiptMock.setup((r) => r.transactionHash).returns(() => hash);
      txnReceiptMock.setup((r) => r.events).returns(() => [eventMock.object]);

      expect(() => getOperationResults(txnReceiptMock.object)).to.throw(
        `no WalletOperationProcessed events found in transaction ${hash}`,
      );
    });

    it("fails when WalletOperationProcessed event is missing args", () => {
      const eventMock = TypeMoq.Mock.ofType<Event>();
      eventMock.setup((e) => e.event).returns(() => "WalletOperationProcessed");
      eventMock.setup((e) => e.args).returns(() => undefined);

      const txnReceiptMock = TypeMoq.Mock.ofType<ContractReceipt>();
      txnReceiptMock.setup((r) => r.events).returns(() => [eventMock.object]);

      expect(() => getOperationResults(txnReceiptMock.object)).to.throw(
        "WalletOperationProcessed event missing args",
      );
    });

    it("decodes WalletOperationProcessed events", () => {
      const otherEventMock = TypeMoq.Mock.ofType<Event>();
      otherEventMock.setup((e) => e.event).returns(() => "Other");

      const errorActionIndex = 0;
      const errorMessage = "halt and catch fire";
      const errorResult = getErrorResult(errorActionIndex, errorMessage);
      const failedEventArgs = new MockResult({
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
      });
      const failedOperationEventMock = TypeMoq.Mock.ofType<Event>();
      failedOperationEventMock
        .setup((e) => e.event)
        .returns(() => "WalletOperationProcessed");
      failedOperationEventMock
        .setup((e) => e.args)
        .returns(() => failedEventArgs);

      const successfulEventArgs = new MockResult({
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
      });
      const successfulOperationEventMock = TypeMoq.Mock.ofType<Event>();
      successfulOperationEventMock
        .setup((e) => e.event)
        .returns(() => "WalletOperationProcessed");
      successfulOperationEventMock
        .setup((e) => e.args)
        .returns(() => successfulEventArgs);

      const txnReceiptMock = TypeMoq.Mock.ofType<ContractReceipt>();
      txnReceiptMock
        .setup((r) => r.events)
        .returns(() => [
          otherEventMock.object,
          failedOperationEventMock.object,
          successfulOperationEventMock.object,
        ]);

      const opResults = getOperationResults(txnReceiptMock.object);
      expect(opResults).to.have.lengthOf(2);

      const [r1, r2] = opResults;
      expect(r1.walletAddress).to.eql(failedEventArgs.wallet);
      expect(r1.nonce.toNumber()).to.eql(
        BigNumber.from(failedEventArgs.nonce).toNumber(),
      );
      expect(r1.actions).to.deep.equal(failedEventArgs.actions);
      expect(r1.success).to.eql(failedEventArgs.success);
      expect(r1.results).to.deep.equal(failedEventArgs.results);
      expect(r1.error?.actionIndex.toNumber()).to.eql(errorActionIndex);
      expect(r1.error?.message).to.eql(errorMessage);

      expect(r2.walletAddress).to.eql(successfulEventArgs.wallet);
      expect(r2.nonce.toNumber()).to.eql(
        BigNumber.from(successfulEventArgs.nonce).toNumber(),
      );
      expect(r2.actions).to.deep.equal(successfulEventArgs.actions);
      expect(r2.success).to.eql(successfulEventArgs.success);
      expect(r2.results).to.deep.equal(successfulEventArgs.results);
      expect(r2.error).to.eql(undefined);
    });
  });
});
