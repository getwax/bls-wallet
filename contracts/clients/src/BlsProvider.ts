import { JsonRpcProvider } from "@ethersproject/providers";
import {
  TransactionReceipt,
  TransactionResponse,
  TransactionRequest,
  BlockTag,
} from "@ethersproject/abstract-provider";
import { Deferrable } from "@ethersproject/properties";
import { BigNumber } from "@ethersproject/bignumber";
import { Networkish } from "@ethersproject/networks";
import { parseEther } from "@ethersproject/units";

import { ActionData, Bundle } from "./signer/types";
import Aggregator, { BundleReceipt } from "./Aggregator";
import BlsSigner, { _constructorGuard } from "./BlsSigner";
import poll from "./helpers/poll";

export default class BlsProvider extends JsonRpcProvider {
  readonly aggregator: Aggregator;
  readonly verificationGatewayAddress: string;
  signer!: BlsSigner;

  constructor(
    aggregatorUrl: string,
    verificationGatewayAddress: string,
    url?: string,
    network?: Networkish,
  ) {
    super(url, network);
    this.aggregator = new Aggregator(aggregatorUrl);
    this.verificationGatewayAddress = verificationGatewayAddress;
  }

  async estimateGas(
    transaction: Deferrable<TransactionRequest>,
  ): Promise<BigNumber> {
    if (!transaction.to) {
      throw new TypeError("Transaction.to should be defined.");
    }

    try {
      const action: ActionData = {
        ethValue: transaction.value?.toString() ?? "0",
        contractAddress: transaction.to.toString(),
        encodedFunction: transaction.data?.toString() ?? "0x",
      };

      const signer = this.getSigner();
      const bundle = await signer.signBlsTransaction(action);

      const gasEstimate = await this.aggregator.estimateFee(bundle);

      return parseEther(gasEstimate.feeRequired);
    } catch (error) {
      throw new Error(`estimateGas() - an unexpected error occured: ${error}`);
    }
  }

  async sendTransaction(
    signedTransaction: string | Promise<string>,
  ): Promise<TransactionResponse> {
    throw new Error(
      "sendTransaction() is not implemented. Call 'sendBlsTransaction()' instead.",
    );
  }

  async sendBlsTransaction(
    bundle: Bundle,
    signer: BlsSigner,
  ): Promise<TransactionResponse> {
    const result = await this.aggregator.add(bundle);

    if ("failures" in result) {
      throw new Error(JSON.stringify(result.failures));
    }

    // TODO: bls-wallet #375 Add multi-action transactions to BlsProvider & BlsSigner
    // We're assuming the first operation and action constitute the correct values. We will need to refactor this when we add multi-action transactions
    const actionData: ActionData = {
      ethValue: bundle.operations[0].actions[0].ethValue.toString(),
      contractAddress:
        bundle.operations[0].actions[0].contractAddress.toString(),
      encodedFunction:
        bundle.operations[0].actions[0].encodedFunction.toString(),
    };

    return signer.constructTransactionResponse(
      actionData,
      result.hash,
      signer.wallet.address,
    );
  }

  getSigner(addressOrIndex?: string | number): BlsSigner {
    if (this.signer) {
      return this.signer;
    }

    const signer = new BlsSigner(_constructorGuard, this, addressOrIndex);
    this.signer = signer;
    return signer;
  }

  async getTransactionReceipt(
    transactionHash: string | Promise<string>,
  ): Promise<TransactionReceipt> {
    const resolvedTransactionHash = await transactionHash;
    return this._getTransactionReceipt(resolvedTransactionHash, 1, 10);
  }

  async waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    retries?: number,
  ): Promise<TransactionReceipt> {
    return this._getTransactionReceipt(
      transactionHash,
      confirmations == null ? 1 : confirmations,
      retries == null ? 10 : retries,
    );
  }

  async _getTransactionReceipt(
    transactionHash: string,
    confirmations: number,
    retries: number,
  ): Promise<TransactionReceipt> {
    let bundleReceipt: BundleReceipt | undefined;

    const getBundleReceipt = async () =>
      await this.aggregator.lookupReceipt(transactionHash);
    const bundleExists = (result: BundleReceipt) => !result;
    bundleReceipt = await poll(getBundleReceipt, bundleExists, retries, 2000);

    if (bundleReceipt === undefined) {
      throw new Error(
        `Could not find bundle receipt for transaction hash: ${transactionHash}.`,
      );
    }

    // TODO: bls-wallet #412 Update values returned in bundle receipt to more closely match ethers transaction response
    return {
      to: "0x",
      from: "0x",
      contractAddress: "0x",
      transactionIndex: parseInt(bundleReceipt.transactionIndex),
      gasUsed: parseEther("0"),
      logsBloom: "",
      blockHash: bundleReceipt.blockHash,
      transactionHash: bundleReceipt.transactionHash,
      logs: [],
      blockNumber: parseInt(bundleReceipt.blockNumber),
      confirmations,
      cumulativeGasUsed: parseEther("0"),
      effectiveGasPrice: parseEther("0"),
      byzantium: false,
      type: 2,
    };
  }
}
