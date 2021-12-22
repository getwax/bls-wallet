import { BlsWalletWrapper, Bundle } from "../../deps.ts";
import TransactionFailure from "./TransactionFailure.ts";

type CreateWalletResult = {
  wallet: BlsWalletWrapper;
  failures: TransactionFailure[];
};

export default class WalletService {
  createWallet(_bun: Bundle): Promise<CreateWalletResult> {
    throw new Error("WalletService: createWallet not implemented");
  }
}
