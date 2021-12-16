import { BlsWalletWrapper, Bundle } from "../../deps.ts";

export default class WalletService {
  createWallet(_bun: Bundle): Promise<BlsWalletWrapper> {
    throw new Error("WalletService: createWallet not implemented");
  }
}
