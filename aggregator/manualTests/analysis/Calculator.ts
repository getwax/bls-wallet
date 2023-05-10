import { once } from "../../deps.ts";

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

  popularMethods = once(() => {
    return Object.entries(this.txDataByMethodId()).sort((a, b) =>
      b[1].length - a[1].length
    );
  });

  topMethodCounts = once(() =>
    this.popularMethods().slice(0, 10).map(([methodId, inputs]) =>
      [methodId, inputs.length] as const
    )
  );

  biggestMethods = once(() => {
    return Object.entries(this.txDataByMethodId()).sort((a, b) =>
      b[1].map((data) => data.length / 2 - 1).reduce(sum) -
      a[1].map((data) => data.length / 2 - 1).reduce(sum)
    );
  });

  biggestMethodCounts = once(() =>
    this.biggestMethods().slice(0, 10).map(([methodId, inputs]) =>
      [methodId, inputs.map((data) => data.length / 2 - 1).reduce(sum)] as const
    )
  );

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
