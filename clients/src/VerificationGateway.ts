import { AggregateTransactionData } from "bls-wallet-signer";
import { ethers } from "ethers";

import VerificationGatewayAbi from "./contractAbis/VerificationGatewayAbi";
import splitHex256 from "./helpers/splitHex256";

type Signer = ethers.Signer;
type Provider = ethers.providers.Provider;

export default class VerificationGateway {
  static abi = VerificationGatewayAbi;
  static address = "0x216b5cA8aB30ce0f4Ba05C4Dbc92E0194a48850c";

  #contract: ethers.Contract;

  constructor(
    signerOrProvider: Signer | Provider | undefined = undefined,
    address = VerificationGateway.address,
  ) {
    this.#contract = new ethers.Contract(
      address,
      VerificationGateway.abi,
      signerOrProvider,
    );
  }

  async actionCalls(
    rewardRecipient: string,
    aggregateTx: AggregateTransactionData,
    overrides: ethers.Overrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    return await this.#contract.actionCalls(
      rewardRecipient,

      // Enhancement: Public keys here are not used for wallets that already
      // exist. In future, in combination with BLSExpander, passing zeros may
      // be preferred to reduce the amount of call data.
      aggregateTx.transactions.map((tx) => splitHex256(tx.publicKey)),

      splitHex256(aggregateTx.signature),
      aggregateTx.transactions.map((tx) => ({
        publicKeyHash: ethers.utils.keccak256(tx.publicKey),
        nonce: tx.nonce,
        rewardTokenAddress: tx.rewardTokenAddress,
        rewardTokenAmount: tx.rewardTokenAmount,
        ethValue: tx.ethValue,
        contractAddress: tx.contractAddress,
        encodedFunction: tx.encodedFunction,
      })),

      overrides,
    );
  }
}
