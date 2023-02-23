/* eslint-disable camelcase */
import { ethers, BigNumber } from "ethers";
import { Deferrable } from "ethers/lib/utils";

import { ActionData, Bundle } from "./signer/types";
import Aggregator, { BundleReceipt } from "./Aggregator";
import BlsSigner, {
  TransactionBatchResponse,
  UncheckedBlsSigner,
  _constructorGuard,
} from "./BlsSigner";
import poll from "./helpers/poll";
import BlsWalletWrapper from "./BlsWalletWrapper";
import {
  AggregatorUtilities__factory,
  BLSWallet__factory,
} from "../typechain-types";
import addSafetyPremiumToFee from "./helpers/addSafetyDivisorToFee";

export default class BlsProvider extends ethers.providers.JsonRpcProvider {
  readonly aggregator: Aggregator;
  readonly verificationGatewayAddress: string;
  readonly aggregatorUtilitiesAddress: string;
  signer!: BlsSigner;

  constructor(
    aggregatorUrl: string,
    verificationGatewayAddress: string,
    aggregatorUtilitiesAddress: string,
    url?: string,
    network?: ethers.providers.Networkish,
  ) {
    super(url, network);
    this.aggregator = new Aggregator(aggregatorUrl);
    this.verificationGatewayAddress = verificationGatewayAddress;
    this.aggregatorUtilitiesAddress = aggregatorUtilitiesAddress;
  }

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

    const action: ActionData = {
      ethValue: transaction.value?.toString() ?? "0",
      contractAddress: transaction.to.toString(),
      encodedFunction: transaction.data?.toString() ?? "0x",
    };

    const nonce = await BlsWalletWrapper.Nonce(
      this.signer.wallet.PublicKey(),
      this.verificationGatewayAddress,
      this,
    );

    const actionsWithFeePaymentAction =
      this._addFeePaymentActionForFeeEstimation([action]);

    const feeEstimate = await this.aggregator.estimateFee(
      this.signer.wallet.sign({
        nonce,
        actions: [...actionsWithFeePaymentAction],
      }),
    );

    const feeRequired = BigNumber.from(feeEstimate.feeRequired);
    return addSafetyPremiumToFee(feeRequired);
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
    const bundle: Bundle = JSON.parse(resolvedTransaction);

    if (bundle.operations.length > 1) {
      throw new Error(
        "Can only operate on single operations. Call provider.sendTransactionBatch instead",
      );
    }

    const result = await this.aggregator.add(bundle);

    if ("failures" in result) {
      throw new Error(JSON.stringify(result.failures));
    }

    const actionData: ActionData = {
      ethValue: bundle.operations[0].actions[0].ethValue,
      contractAddress: bundle.operations[0].actions[0].contractAddress,
      encodedFunction: bundle.operations[0].actions[0].encodedFunction,
    };

    return this.signer.constructTransactionResponse(
      actionData,
      result.hash,
      this.signer.wallet.address,
    );
  }

  async sendTransactionBatch(
    signedTransactionBatch: string,
  ): Promise<TransactionBatchResponse> {
    // TODO: bls-wallet #413 Move references to private key outside of BlsSigner.
    // Without doing this, we would have to call `const signer = this.getSigner(privateKey)`.
    // We do not want to pass the private key to this method.
    if (!this.signer) {
      throw new Error("Call provider.getSigner first");
    }

    const bundle: Bundle = JSON.parse(signedTransactionBatch);

    const result = await this.aggregator.add(bundle);

    if ("failures" in result) {
      throw new Error(JSON.stringify(result.failures));
    }

    const actionData: Array<ActionData> = bundle.operations
      .map((operation) => operation.actions)
      .flat();

    return this.signer.constructTransactionBatchResponse(
      actionData,
      result.hash,
      this.signer.wallet.address,
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

  override async getTransactionCount(
    address: string | Promise<string>,
    blockTag?:
      | ethers.providers.BlockTag
      | Promise<ethers.providers.BlockTag>
      | undefined,
  ): Promise<number> {
    const walletContract = BLSWallet__factory.connect(await address, this);

    const code = await walletContract.provider.getCode(address, blockTag);

    if (code === "0x") {
      // The wallet doesn't exist yet. Wallets are lazily created, so the nonce
      // is effectively zero, since that will be accepted as valid for a first
      // operation that also creates the wallet.
      return 0;
    }

    return Number(await walletContract.nonce());
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

  _addFeePaymentActionForFeeEstimation(
    actions: Array<ActionData>,
  ): Array<ActionData> {
    const aggregatorUtilitiesContract = AggregatorUtilities__factory.connect(
      this.aggregatorUtilitiesAddress,
      this,
    );

    return [
      ...actions,
      {
        // Provide 1 wei with this action so that the fee transfer to
        // tx.origin can be included in the gas estimate.
        ethValue: 1,
        contractAddress: this.aggregatorUtilitiesAddress,
        encodedFunction:
          aggregatorUtilitiesContract.interface.encodeFunctionData(
            "sendEthToTxOrigin",
          ),
      },
    ];
  }

  _addFeePaymentActionWithSafeFee(
    actions: Array<ActionData>,
    fee: BigNumber,
  ): Array<ActionData> {
    const aggregatorUtilitiesContract = AggregatorUtilities__factory.connect(
      this.aggregatorUtilitiesAddress,
      this,
    );

    return [
      ...actions,
      {
        ethValue: fee,
        contractAddress: this.aggregatorUtilitiesAddress,
        encodedFunction:
          aggregatorUtilitiesContract.interface.encodeFunctionData(
            "sendEthToTxOrigin",
          ),
      },
    ];
  }
}
