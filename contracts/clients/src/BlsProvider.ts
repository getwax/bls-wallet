import { ethers, BigNumber } from "ethers";
import { parseEther, Deferrable } from "ethers/lib/utils";

import { ActionDataDto, BundleDto } from "./signer/types";
import Aggregator, { BundleReceipt } from "./Aggregator";
import BlsSigner, { UncheckedBlsSigner, _constructorGuard } from "./BlsSigner";
import poll from "./helpers/poll";

export default class BlsProvider extends ethers.providers.JsonRpcProvider {
  readonly aggregator: Aggregator;
  readonly verificationGatewayAddress: string;
  signer: BlsSigner | undefined;

  constructor(
    aggregatorUrl: string,
    verificationGatewayAddress: string,
    url?: string,
    network?: ethers.providers.Networkish,
  ) {
    super(url, network);
    this.aggregator = new Aggregator(aggregatorUrl);
    this.verificationGatewayAddress = verificationGatewayAddress;
  }

  // TODO: bls-wallet #410 estimate gas for a transaction
  override async estimateGas(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<BigNumber> {
    if (!transaction.to) {
      throw new TypeError("Transaction.to should be defined");
    }

    // TODO: bls-wallet #413 Move references to private key outside of BlsSigner.
    // Without doing this, we would have to call `const signer = this.getSigner(privateKey)`.
    // We do not want to pass the private key to this method.
    if (!this.signer) {
      throw new Error("Call provider.getSigner first");
    }

    const signedTransaction = await this.signer.signTransaction(transaction);
    const bundleDto: BundleDto = JSON.parse(signedTransaction);

    const gasEstimate = await this.aggregator.estimateFee(bundleDto);
    return parseEther(gasEstimate.feeRequired);
  }

  override async sendTransaction(
    signedTransaction: string | Promise<string>,
  ): Promise<ethers.providers.TransactionResponse> {
    // TODO: bls-wallet #413 Move references to private key outside of BlsSigner.
    // Without doing this, we would have to call `const signer = this.getSigner(privateKey)`.
    // We do not want to pass the private key to this method.
    if (!this.signer) {
      throw new Error("Call provider.getSigner first");
    }

    const resolvedTransaction = await signedTransaction;

    const bundleDto: BundleDto = JSON.parse(resolvedTransaction);
    const result = await this.aggregator.add(bundleDto);

    if ("failures" in result) {
      throw new Error(JSON.stringify(result.failures));
    }

    // TODO: bls-wallet #375 Add multi-action transactions to BlsProvider & BlsSigner
    // We're assuming the first operation and action constitute the correct values. We will need to refactor this when we add multi-action transactions
    const actionData: ActionDataDto = {
      ethValue: bundleDto.operations[0].actions[0].ethValue,
      contractAddress: bundleDto.operations[0].actions[0].contractAddress,
      encodedFunction: bundleDto.operations[0].actions[0].encodedFunction,
    };

    return this.signer.constructTransactionResponse(
      actionData,
      result.hash,
      this.signer.blsSignerWrapper!.wallet.address,
    );
  }

  override getSigner(
    privateKey: string,
    addressOrIndex?: string | number,
  ): BlsSigner {
    if (this.signer) {
      return this.signer;
    }

    const signer = new BlsSigner(
      _constructorGuard,
      this,
      privateKey,
      addressOrIndex,
    );
    this.signer = signer;
    return signer;
  }

  override getUncheckedSigner(
    privateKey: string,
    addressOrIndex?: string,
  ): UncheckedBlsSigner {
    return this.getSigner(privateKey, addressOrIndex).connectUnchecked();
  }

  override async getTransactionReceipt(
    transactionHash: string | Promise<string>,
  ): Promise<ethers.providers.TransactionReceipt> {
    const resolvedTransactionHash = await transactionHash;
    return this._getTransactionReceipt(resolvedTransactionHash, 1, 20);
  }

  override async waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    retries?: number,
  ): Promise<ethers.providers.TransactionReceipt> {
    return this._getTransactionReceipt(
      transactionHash,
      confirmations ?? 1,
      retries ?? 20,
    );
  }

  async _getTransactionReceipt(
    transactionHash: string,
    confirmations: number,
    retries: number,
  ): Promise<ethers.providers.TransactionReceipt> {
    const getBundleReceipt = async () =>
      await this.aggregator.lookupReceipt(transactionHash);
    const bundleExists = (result: BundleReceipt) => !result;

    const bundleReceipt = await poll(
      getBundleReceipt,
      bundleExists,
      retries,
      2000,
    );

    if (!bundleReceipt) {
      throw new Error(
        `Could not find bundle receipt for transaction hash: ${transactionHash}`,
      );
    }

    return {
      to: bundleReceipt.to,
      from: bundleReceipt.from,
      contractAddress: bundleReceipt.contractAddress,
      transactionIndex: bundleReceipt.transactionIndex,
      root: bundleReceipt.root,
      gasUsed: bundleReceipt.gasUsed,
      logsBloom: bundleReceipt.logsBloom,
      blockHash: bundleReceipt.blockHash,
      transactionHash: bundleReceipt.transactionHash,
      logs: bundleReceipt.logs,
      blockNumber: bundleReceipt.blockNumber,
      confirmations: bundleReceipt.confirmations ?? confirmations,
      cumulativeGasUsed: bundleReceipt.effectiveGasPrice,
      effectiveGasPrice: bundleReceipt.effectiveGasPrice,
      byzantium: bundleReceipt.byzantium,
      type: bundleReceipt.type,
      status: bundleReceipt.status,
    };
  }
}
