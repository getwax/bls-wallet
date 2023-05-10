import { mapValues, once } from "../../deps.ts";

import blocks from "../../data/blocksSample.json" assert { type: "json" };
import { sum } from "./util.ts";
import MultiEncoder from "./MultiEncoder.ts";
import assert from "../../src/helpers/assert.ts";
import VLQ from "./VLQ.ts";

export default class Calculator {
  constructor(
    public multiEncoder: MultiEncoder,
  ) {}

  transactions = once(() => blocks.map((b) => b.transactions).flat());
  transactionData = once(() => this.transactions().map((tx) => tx.input));

  encodedTransactionData = once(() =>
    this.transactionData().map((data) => this.multiEncoder.encode(data))
  );

  decodedTransactionData = once(() =>
    this.encodedTransactionData().map(
      (input) => this.multiEncoder.decode(input),
    )
  );

  checkDecodedTransactionData = once(() => {
    const transactionData = this.transactions().map((tx) => tx.input);
    const decodedTransactionData = this.decodedTransactionData();

    const len = transactionData.length;
    assert(decodedTransactionData.length === len);

    for (let i = 0; i < len; i++) {
      assert(
        transactionData[i] === decodedTransactionData[i],
        `tx ${i}: ${transactionData[i]} !== ${decodedTransactionData[i]}`,
      );
    }
  });

  txDataByMethodId = once(() => {
    const txDataByMethodId: Record<string, string[]> = {};

    for (const data of this.transactionData()) {
      txDataByMethodId[data.slice(0, 10)] ??= [];
      txDataByMethodId[data.slice(0, 10)].push("0x" + data.slice(10));
    }

    return txDataByMethodId;
  });

  txDataStatsByMethodId = once(() =>
    mapValues(
      this.txDataByMethodId(),
      (dataArray, methodId) => {
        const count = dataArray.length;

        const baselineLen = dataArray
          .map((data) => 1 + (methodId.length / 2 - 1) + (data.length / 2 - 1))
          .reduce(sum);

        const avgBaselineLen = baselineLen / count;

        const encodedLen = dataArray
          .map((data) =>
            this.multiEncoder.encode(methodId + data.slice(2)).length / 2 - 1
          )
          .reduce(sum);

        const avgEncodedLen = encodedLen / count;

        return {
          count,
          baselineLen,
          avgBaselineLen,
          encodedLen,
          avgEncodedLen,
        };
      },
    )
  );

  popularMethods = once(() => {
    return Object.entries(this.txDataStatsByMethodId()).sort((a, b) =>
      b[1].count - a[1].count
    );
  });

  biggestMethods = once(() => {
    return Object.entries(this.txDataStatsByMethodId()).sort((a, b) =>
      b[1].baselineLen -
      a[1].baselineLen
    );
  });

  biggestEncodedMethods = once(() => {
    return Object.entries(this.txDataStatsByMethodId()).sort((a, b) =>
      b[1].encodedLen -
      a[1].encodedLen
    );
  });

  totalLength = once(() =>
    this.transactions().map((t) => t.input.length / 2 - 1).reduce(sum)
  );

  baselineEncodedLength = once(() => {
    let len = this.totalLength();

    for (const txData of this.transactionData()) {
      len += VLQ.encode(txData.length / 2 - 1).length / 2 - 1;
    }

    return len;
  });

  totalEncodedLength = once(() =>
    this.encodedTransactionData().map((data) => data.length / 2 - 1).reduce(sum)
  );

  compressionRatio = once(() =>
    this.totalEncodedLength() / this.baselineEncodedLength()
  );
}
