import { ethers } from "../../deps/index.ts";

import AddTransactionFailure from "./AddTransactionFailure.ts";
import * as env from "./env.ts";
import TxTable, { TransactionData } from "./TxTable.ts";
import WalletService from "./WalletService.ts";

export default class TxService {
  static defaultConfig = {
    futureBatchSize: env.FUTURE_BATCH_SIZE,
    maxFutureTxs: env.MAX_FUTURE_TXS,
  };

  constructor(
    public readyTxTable: TxTable,
    public futureTxTable: TxTable,
    public walletService: WalletService,
    public config = TxService.defaultConfig,
  ) {}

  async add(txData: TransactionData): Promise<AddTransactionFailure[]> {
    const { failures, nextNonce } = await this.walletService.checkTx(txData);

    if (failures.length > 0) {
      return failures;
    }

    const lowestAcceptableNonce = await this.LowestAcceptableNonce(
      nextNonce,
      txData.pubKey,
    );

    if (lowestAcceptableNonce.gt(txData.nonce)) {
      console.warn(
        "Not implemented: replace future transaction",
      );

      return [
        {
          type: "duplicate-nonce",
          description: [
            `nonce ${txData.nonce} is already queued for aggregation (the`,
            `lowest acceptable nonce for this wallet is`,
            `${lowestAcceptableNonce.toString()})`,
          ].join(" "),
        },
      ];
    }

    if (lowestAcceptableNonce.eq(txData.nonce)) {
      await this.readyTxTable.add(txData);
      await this.tryMoveFutureTxs(txData.pubKey, lowestAcceptableNonce.add(1));
    } else {
      await this.ensureFutureTxSpace();
      await this.futureTxTable.add(txData);
    }

    return [];
  }

  /**
   * Find the lowest acceptable nonce based on chain and the ready tx table.
   *
   * Here 'acceptable' means able to be accepted into the ready tx table. This
   * means that it comes after the transactions on chain, but also that it comes
   * after the transactions already in the ready tx table.
   */
  async LowestAcceptableNonce(
    nextChainNonce: ethers.BigNumber,
    pubKey: string,
  ): Promise<ethers.BigNumber> {
    const nextLocalNonce = await this.readyTxTable.nextNonceOf(pubKey);

    const lowestAcceptableNonce = nextChainNonce.gt(nextLocalNonce ?? 0)
      ? nextChainNonce
      : ethers.BigNumber.from(nextLocalNonce);

    return lowestAcceptableNonce;
  }

  /**
   * Move any future txs for the given public key that have become ready into
   * ready txs.
   */
  async tryMoveFutureTxs(
    pubKey: string,
    lowestAcceptableNonce: ethers.BigNumber,
  ) {
    let futureTxs;
    let foundGap = false;

    do {
      const futureTxsToRemove: TransactionData[] = [];
      const txsToAdd: TransactionData[] = [];

      futureTxs = await this.futureTxTable.pubKeyTxsInNonceOrder(
        pubKey,
        this.config.futureBatchSize,
      );

      for (const tx of futureTxs) {
        if (lowestAcceptableNonce.gt(tx.nonce)) {
          console.warn(`Nonce from past was in futureTxs`);
          futureTxsToRemove.push(tx);
        } else if (lowestAcceptableNonce.eq(tx.nonce)) {
          futureTxsToRemove.push(tx);
          const txWithoutId = { ...tx };
          delete txWithoutId.txId;
          txsToAdd.push(txWithoutId);
          lowestAcceptableNonce = lowestAcceptableNonce.add(1);
        } else {
          foundGap = true;
          break;
        }
      }

      await this.readyTxTable.add(...txsToAdd);
      await this.futureTxTable.remove(...futureTxsToRemove);
    } while (futureTxs.length !== 0 && !foundGap);
  }

  /**
   * Ensures that at least one new transaction can be inserted into the future
   * tx table without exceeding maxFutureTxs. This is achieved by dropping txs
   * that have been stored the longest.
   */
  async ensureFutureTxSpace() {
    const size = await this.futureTxTable.count();

    if (size >= this.config.maxFutureTxs) {
      const first = await this.futureTxTable.First();

      if (first === null) {
        console.warn(
          "Future txs unexpectedly empty when it seemed to need pruning",
        );

        return;
      }

      const newFirstId = (
        first.txId! + (Number(size) - this.config.maxFutureTxs + 1)
      );

      this.futureTxTable.clearBeforeId(newFirstId);
    }
  }
}
