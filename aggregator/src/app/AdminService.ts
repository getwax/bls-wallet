import BundleTable from "./BundleTable.ts";
import EthereumService from "./EthereumService.ts";

export default class AdminService {
  constructor(
    private ethereumService: EthereumService,
    private bundleTable: BundleTable,
  ) {}

  resetBundles() {
    this.bundleTable.clear();
  }

  bundleCount(): number {
    return this.bundleTable.count();
  }
}
