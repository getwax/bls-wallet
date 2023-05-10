import { once } from "../../deps.ts";

import blocks from "../../data/blocksSample.json" assert { type: "json" };
import { sum } from "./util.ts";

export default class Calculator {
  transactions = once(() => blocks.map((b) => b.transactions).flat());

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
}
