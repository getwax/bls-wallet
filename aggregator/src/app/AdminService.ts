import TxTable from "./TxTable.ts";
import EthereumService from "./EthereumService.ts";

export default class AdminService {
  constructor(
    private ethereumService: EthereumService,
    private readyTxTable: TxTable,
    private futureTxTable: TxTable,
  ) {}

  async resetTxs() {
    await this.futureTxTable.clear();
    await this.readyTxTable.clear();
  }

  async txCount(): Promise<bigint> {
    return await this.readyTxTable.count();
  }
}
