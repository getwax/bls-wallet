import { once } from "../../deps.ts";

import blocks from "../../data/blocksSample.json" assert { type: "json" };
import { sum } from "./util.ts";
import MultiEncoder from "./MultiEncoder.ts";
import assert from "../../src/helpers/assert.ts";

export default class Calculator {
  constructor(
    public multiEncoder: MultiEncoder,
  ) {}

  transactions = once(() => blocks.map((b) => b.transactions).flat());

  encodedTransactionData = once(() =>
    this.transactions().map((tx) => this.multiEncoder.encode(tx.input))
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
      assert(transactionData[i] === decodedTransactionData[i]);
    }
  });

  txDataByMethodId = once(() => {
    const txDataByMethodId: Record<string, string[]> = {};

    for (const tx of this.transactions()) {
      txDataByMethodId[tx.input.slice(0, 10)] ??= [];
      txDataByMethodId[tx.input.slice(0, 10)].push("0x" + tx.input.slice(10));
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

  totalLength = once(() =>
    this.transactions().map((t) => t.input.length / 2 - 1).reduce(sum)
  );

  totalEncodedLength = once(() =>
    this.encodedTransactionData().map((data) => data.length / 2 - 1).reduce(sum)
  );
}
