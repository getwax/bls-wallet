import { AggregateTransactionData } from "bls-wallet-signer";
import { ethers } from "ethers";

import VerificationGatewayAbi from "./contractAbis/VerificationGatewayAbi";
import splitHex256 from "./helpers/splitHex256";

type Signer = ethers.Signer;
type Provider = ethers.providers.Provider;

export default class VerificationGateway {
  static abi = VerificationGatewayAbi;

  #contract: ethers.Contract;

  constructor(
    public address: string,
    signerOrProvider: Signer | Provider | undefined = undefined,
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
        ethValue: tx.ethValue,
        contractAddress: tx.contractAddress,
        encodedFunction: tx.encodedFunction,
      })),

      overrides,
    );
  }

  async walletFromHash(publicKeyHash: string): Promise<string | undefined> {
    const address: string = await this.#contract.walletFromHash(
      publicKeyHash,
    );

    if (address === ethers.constants.AddressZero) {
      return undefined;
    }

    return address;
  }
}
