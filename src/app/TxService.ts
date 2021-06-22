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
    const failures = await this.walletService.checkTx(txData);

    if (failures.length === 0) {
      await this.txTable.add(txData);
      // TODO: send tx(s) after batch count, or N ms since last send.
    }

    return failures;
  }
}
