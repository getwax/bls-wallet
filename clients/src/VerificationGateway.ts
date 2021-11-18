import { Transaction } from "bls-wallet-signer";
import { ethers } from "ethers";

import VerificationGatewayAbi from "./contractAbis/VerificationGatewayAbi";
import splitHex256 from "./helpers/splitHex256";

type Signer = ethers.Signer;
type Provider = ethers.providers.Provider;

export default class VerificationGateway {
  static abi = VerificationGatewayAbi;

  contract: ethers.Contract;

  constructor(
    public address: string,
    signerOrProvider: Signer | Provider | undefined = undefined,
  ) {
    this.contract = new ethers.Contract(
      address,
      VerificationGateway.abi,
      signerOrProvider,
    );
  }

  async actionCalls(
    tx: Transaction,
    overrides: ethers.Overrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    return await this.contract.actionCalls(
      tx.subTransactions.map((subTx) => splitHex256(subTx.publicKey)),
      splitHex256(tx.signature),
      tx.subTransactions.map((subTx) => ({
        nonce: subTx.nonce,
        atomic: subTx.atomic,
        actions: subTx.actions,
      })),
      overrides,
    );
  }

  async walletFromHash(publicKeyHash: string): Promise<string> {
    return await this.contract.walletFromHash(publicKeyHash);
  }
}
