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

import { ActionDataDto, Bundle } from "./signer/types";
import Aggregator, { BundleReceipt } from "./Aggregator";
import BlsSigner from "./BlsSigner";
import { _constructorGuard } from "./BlsSigner";
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
    try {
      const action: ActionDataDto = {
        ethValue: transaction.value?.toString() ?? "0",
        contractAddress: transaction.to?.toString()!, // TODO: Unsure about this... should we be stating something is nullable then telling the compiler it's not???
        encodedFunction: transaction.data?.toString() ?? "0x",
      };

      const signer = this.getSigner();
      const bundle = await signer.signBlsTransaction(action);

      const aggregator = this.aggregator;
      const gasEstimate = await aggregator.estimateFee(bundle);

      return parseEther(gasEstimate.feeRequired);
    } catch (error) {
      throw new Error(`estimateGas() - an unexpected error occured: ${error}`);
    }
  }

  async sendTransaction(
    signedTransaction: string | Promise<string>,
  ): Promise<TransactionResponse> {
    throw new Error(
      "sendTransaction() is not implemented. Call 'sendBlsTransaction()' instead",
    );
  }

  async sendBlsTransaction(
    bundle: Bundle,
    signer: BlsSigner,
  ): Promise<TransactionResponse> {
    try {
      const agg = this.aggregator;
      const result = await agg.add(bundle);

      if ("failures" in result) {
        throw new Error(result.failures.join("\n"));
      }

      // TODO: We're assuming the first operation and action constitute the correct values. We will need to refactor this when we add multi-action transactions
      const actionDataDto: ActionDataDto = {
        ethValue: bundle.operations[0].actions[0].ethValue.toString(),
        contractAddress:
          bundle.operations[0].actions[0].contractAddress.toString(),
        encodedFunction:
          bundle.operations[0].actions[0].encodedFunction.toString(),
      };

      return signer.constructTransactionResponse(
        actionDataDto,
        result.hash,
        signer._address,
      );
    } catch (error) {
      throw error;
    }
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
    const aggregator = this.aggregator;

    const getBundleReceipt = async () =>
      await aggregator.lookupReceipt(transactionHash);
    const bundleExists = (result: BundleReceipt) => !result;
    bundleReceipt = await poll(getBundleReceipt, bundleExists, retries, 2000);

    if (bundleReceipt === undefined) {
      throw new Error(
        `Could not find bundle receipt for transaction hash: ${transactionHash}`,
      );
    }

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

  // UN-IMPLEMENTED METHODS
  // TODO: Why is this cause the tests to fail on blsSigner.initWallet()???????
  // async call(
  //   transaction: Deferrable<TransactionRequest>,
  //   blockTag?: BlockTag | Promise<BlockTag>,
  // ): Promise<string> {
  //   throw new Error("call() is not implemented");
  // }

  // async getTransaction(hash: string): Promise<TransactionResponse> {
  //   throw new Error("getTransaction() is not implemented");
  // }
}
