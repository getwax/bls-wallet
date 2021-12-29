import BundleTable from "./BundleTable.ts";
import EthereumService from "./EthereumService.ts";

export default class AdminService {
  constructor(
    private ethereumService: EthereumService,
    private bundleTable: BundleTable,
  ) {}

  async resetBundles() {
    await this.bundleTable.clear();
  }

  async bundleCount(): Promise<bigint> {
    return await this.bundleTable.count();
  }
}
