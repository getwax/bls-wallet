import { ethers } from "../../deps/index.ts";

import AddTransactionFailure from "./AddTransactionFailure.ts";
import TxTable, { TransactionData } from "./TxTable.ts";
import WalletService from "./WalletService.ts";

export default class TxService {
  constructor(
    public txTable: TxTable,
    public pendingTxTable: TxTable,
    public walletService: WalletService,
  ) {}

  async add(txData: TransactionData): Promise<AddTransactionFailure[]> {
    const { failures, nextNonce } = await this.walletService.checkTx(txData);

    if (failures.length > 0) {
      return failures;
    }

    const nextLocalNonce = await this.txTable.nextNonceOf(txData.pubKey);

    const nextAcceptNonce = nextNonce.gt(nextLocalNonce ?? 0)
      ? nextNonce
      : ethers.BigNumber.from(nextLocalNonce);

    if (nextAcceptNonce.gt(txData.nonce)) {
      console.warn(
        "Not implemented: replace pending transaction",
      );

      return [
        {
          type: "duplicate-nonce",
          description: [
            `nonce ${txData.nonce} is already queued for aggregation (the`,
            `first acceptable nonce for this wallet is`,
            `${nextAcceptNonce.toString()})`,
          ].join(" "),
        },
      ];
    }

    if (nextAcceptNonce.eq(txData.nonce)) {
      await this.txTable.add(txData);
      await this.tryMovePendingTxs(txData.pubKey);
    } else {
      await this.pendingTxTable.add(txData);
    }

    return [];
  }

  async tryMovePendingTxs(pubKey: string) {
    // TODO
  }
}
