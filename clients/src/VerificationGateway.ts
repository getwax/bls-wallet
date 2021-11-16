import { AggregateTransactionData } from "bls-wallet-signer";
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
    aggregateTx: AggregateTransactionData,
    overrides: ethers.Overrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    return await this.contract.actionCalls(
      aggregateTx.transactions.map((tx) => splitHex256(tx.publicKey)),
      splitHex256(aggregateTx.signature),
      aggregateTx.transactions.map((tx) => ({
        nonce: tx.nonce,
        ethValue: tx.ethValue,
        contractAddress: tx.contractAddress,
        encodedFunction: tx.encodedFunction,
      })),
      overrides,
    );
  }

  async walletFromHash(publicKeyHash: string): Promise<string> {
    return await this.contract.walletFromHash(publicKeyHash);
  }
}
