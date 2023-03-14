/* eslint-disable camelcase */
import { ethers, BigNumber, Signer, Bytes, BigNumberish } from "ethers";
import {
  AccessListish,
  Deferrable,
  hexlify,
  isBytes,
  RLP,
} from "ethers/lib/utils";

import BlsProvider from "./BlsProvider";
import BlsWalletWrapper from "./BlsWalletWrapper";
import addSafetyPremiumToFee from "./helpers/addSafetyDivisorToFee";
import { ActionData, bundleToDto } from "./signer";

export const _constructorGuard = {};

/**
 * @property gas - (THIS PROPERTY IS NOT USED BY BLS WALLET) transaction gas limit
 * @property maxPriorityFeePerGas - (THIS PROPERTY IS NOT USED BY BLS WALLET) miner tip aka priority fee
 * @property maxFeePerGas - (THIS PROPERTY IS NOT USED BY BLS WALLET) the maximum total fee per gas the sender is willing to pay (includes the network/base fee and miner/priority fee) in wei
 * @property nonce - integer of a nonce. This allows overwriting your own pending transactions that use the same nonce
 * @property chainId - chain ID that this transaction is valid on
 * @property accessList - (THIS PROPERTY IS NOT USED BY BLS WALLET) EIP-2930 access list
 */
export type BatchOptions = {
  gas?: BigNumberish;
  maxPriorityFeePerGas: BigNumberish;
  maxFeePerGas: BigNumberish;
  nonce: BigNumberish;
  chainId: number;
  accessList?: AccessListish;
};

/**
 * @property transactions - an array of transaction objects
 * @property batchOptions - optional batch options taken into account by smart contract wallets
 */
export type TransactionBatch = {
  transactions: Array<ethers.providers.TransactionRequest>;
  batchOptions?: BatchOptions;
};

export interface TransactionBatchResponse {
  transactions: Array<ethers.providers.TransactionResponse>;
  awaitBatchReceipt: (
    confirmations?: number,
  ) => Promise<ethers.providers.TransactionReceipt>;
}

export default class BlsSigner extends Signer {
  override readonly provider: BlsProvider;
  readonly verificationGatewayAddress!: string;
  readonly aggregatorUtilitiesAddress!: string;
  wallet!: BlsWalletWrapper;
  _index: number;
  _address: string;

  readonly initPromise: Promise<void>;

  constructor(
    constructorGuard: Record<string, unknown>,
    provider: BlsProvider,
    privateKey: string,
    readonly addressOrIndex?: string | number,
  ) {
    super();
    this.provider = provider;
    this.verificationGatewayAddress = this.provider.verificationGatewayAddress;
    this.aggregatorUtilitiesAddress = this.provider.aggregatorUtilitiesAddress;
    this.initPromise = this.initializeWallet(privateKey);

    if (constructorGuard !== _constructorGuard) {
      throw new Error(
        "do not call the BlsSigner constructor directly; use provider.getSigner",
      );
    }

    if (addressOrIndex === null || addressOrIndex === undefined) {
      addressOrIndex = 0;
    }

    if (typeof addressOrIndex === "string") {
      this._address = this.provider.formatter.address(addressOrIndex);
      this._index = null as any;
    } else if (typeof addressOrIndex === "number") {
      this._address = null as any;
      this._index = addressOrIndex;
    } else {
      throw new Error(`
        invalid address or index. addressOrIndex: ${addressOrIndex}`);
    }
  }

  private async initializeWallet(privateKey: string) {
    this.wallet = await BlsWalletWrapper.connect(
      privateKey,
      this.verificationGatewayAddress,
      this.provider,
    );
  }

  override async sendTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<ethers.providers.TransactionResponse> {
    await this.initPromise;

    if (!transaction.to) {
      throw new TypeError("Transaction.to should be defined");
    }

    const nonce = await BlsWalletWrapper.Nonce(
      this.wallet.PublicKey(),
      this.verificationGatewayAddress,
      this.provider,
    );

    const action: ActionData = {
      ethValue: transaction.value?.toString() ?? "0",
      contractAddress: transaction.to.toString(),
      encodedFunction: transaction.data?.toString() ?? "0x",
    };

    const feeEstimate = await this.provider.estimateGas(transaction);
    const actionsWithSafeFee = this.provider._addFeePaymentActionWithSafeFee(
      [action],
      feeEstimate,
    );

    const bundle = this.wallet.sign({
      nonce,
      actions: [...actionsWithSafeFee],
    });
    const result = await this.provider.aggregator.add(bundle);

    if ("failures" in result) {
      throw new Error(JSON.stringify(result.failures));
    }

    return this.constructTransactionResponse(
      action,
      result.hash,
      this.wallet.address,
      nonce,
    );
  }

  async sendTransactionBatch(
    transactionBatch: TransactionBatch,
  ): Promise<TransactionBatchResponse> {
    await this.initPromise;

    let nonce: BigNumber;
    if (transactionBatch.batchOptions) {
      const validatedBatchOptions = await this._validateBatchOptions(
        transactionBatch.batchOptions,
      );

      nonce = validatedBatchOptions.nonce as BigNumber;
    } else {
      nonce = await BlsWalletWrapper.Nonce(
        this.wallet.PublicKey(),
        this.verificationGatewayAddress,
        this.provider,
      );
    }

    const actions: Array<ActionData> = transactionBatch.transactions.map(
      (transaction, i) => {
        if (!transaction.to) {
          throw new TypeError(`Transaction.to is missing on transaction ${i}`);
        }

        return {
          ethValue: transaction.value?.toString() ?? "0",
          contractAddress: transaction.to!.toString(),
          encodedFunction: transaction.data?.toString() ?? "0x",
        };
      },
    );

    const actionsWithFeePaymentAction =
      this.provider._addFeePaymentActionForFeeEstimation(actions);

    const feeEstimate = await this.provider.aggregator.estimateFee(
      this.wallet.sign({
        nonce,
        actions: [...actionsWithFeePaymentAction],
      }),
    );

    const safeFee = addSafetyPremiumToFee(
      BigNumber.from(feeEstimate.feeRequired),
    );

    const actionsWithSafeFee = this.provider._addFeePaymentActionWithSafeFee(
      actions,
      safeFee,
    );

    const bundle = this.wallet.sign({
      nonce,
      actions: [...actionsWithSafeFee],
    });
    const result = await this.provider.aggregator.add(bundle);

    if ("failures" in result) {
      throw new Error(JSON.stringify(result.failures));
    }

    return this.constructTransactionBatchResponse(
      actions,
      result.hash,
      this.wallet.address,
      nonce,
    );
  }

  async getAddress(): Promise<string> {
    await this.initPromise;
    if (this._address) {
      return this._address;
    }

    this._address = this.wallet.address;
    return this._address;
  }

  // Construct a response that follows the ethers TransactionResponse type
  async constructTransactionResponse(
    action: ActionData,
    hash: string,
    from: string,
    nonce?: BigNumber,
  ): Promise<ethers.providers.TransactionResponse> {
    await this.initPromise;
    const chainId = await this.getChainId();
    if (!nonce) {
      nonce = await BlsWalletWrapper.Nonce(
        this.wallet.PublicKey(),
        this.verificationGatewayAddress,
        this.provider,
      );
    }

    return {
      hash,
      to: action.contractAddress,
      from,
      nonce: nonce.toNumber(),
      gasLimit: BigNumber.from("0x0"),
      data: action.encodedFunction.toString(),
      value: BigNumber.from(action.ethValue),
      chainId,
      type: 2,
      confirmations: 1,
      wait: (confirmations?: number) => {
        return this.provider.waitForTransaction(hash, confirmations);
      },
    };
  }

  async constructTransactionBatchResponse(
    actions: Array<ActionData>,
    hash: string,
    from: string,
    nonce?: BigNumber,
  ): Promise<TransactionBatchResponse> {
    await this.initPromise;
    const chainId = await this.getChainId();
    if (!nonce) {
      nonce = await BlsWalletWrapper.Nonce(
        this.wallet.PublicKey(),
        this.verificationGatewayAddress,
        this.provider,
      );
    }

    const transactions: Array<ethers.providers.TransactionResponse> =
      actions.map((action) => {
        return {
          hash,
          to: action.contractAddress,
          from,
          nonce: nonce!.toNumber(),
          gasLimit: BigNumber.from("0x0"),
          data: action.encodedFunction.toString(),
          value: BigNumber.from(action.ethValue),
          chainId,
          type: 2,
          confirmations: 1,
          wait: (confirmations?: number) => {
            return this.provider.waitForTransaction(hash, confirmations);
          },
        };
      });

    return {
      transactions,
      awaitBatchReceipt: (confirmations?: number) => {
        return this.provider.waitForTransaction(hash, confirmations);
      },
    };
  }

  /**
   * This method passes calls through to the underlying node and allows users to unlock EOA accounts through this provider.
   * The personal namespace is used to manage keys for ECDSA signing. BLS keys are not supported natively by execution clients.
   */
  async unlock(password: string): Promise<boolean> {
    const provider = this.provider;

    const address = await this.getAddress();

    return provider.send("personal_unlockAccount", [
      address.toLowerCase(),
      password,
      null,
    ]);
  }

  override async signTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<string> {
    await this.initPromise;

    if (!transaction.to) {
      throw new TypeError("Transaction.to should be defined");
    }

    const action: ActionData = {
      ethValue: transaction.value?.toString() ?? "0",
      contractAddress: transaction.to.toString(),
      encodedFunction: transaction.data?.toString() ?? "0x",
    };

    const nonce = await BlsWalletWrapper.Nonce(
      this.wallet.PublicKey(),
      this.verificationGatewayAddress,
      this.provider,
    );

    const feeEstimate = await this.provider.estimateGas(transaction);

    const actionsWithSafeFee = this.provider._addFeePaymentActionWithSafeFee(
      [action],
      feeEstimate,
    );

    const bundle = this.wallet.sign({
      nonce,
      actions: [...actionsWithSafeFee],
    });

    return JSON.stringify(bundleToDto(bundle));
  }

  async signTransactionBatch(
    transactionBatch: TransactionBatch,
  ): Promise<string> {
    await this.initPromise;

    let nonce: BigNumber;
    if (transactionBatch.batchOptions) {
      const validatedBatchOptions = await this._validateBatchOptions(
        transactionBatch.batchOptions,
      );

      nonce = validatedBatchOptions.nonce as BigNumber;
    } else {
      nonce = await BlsWalletWrapper.Nonce(
        this.wallet.PublicKey(),
        this.verificationGatewayAddress,
        this.provider,
      );
    }

    const actions: Array<ActionData> = transactionBatch.transactions.map(
      (transaction, i) => {
        if (!transaction.to) {
          throw new TypeError(`Transaction.to is missing on transaction ${i}`);
        }

        return {
          ethValue: transaction.value?.toString() ?? "0",
          contractAddress: transaction.to!.toString(),
          encodedFunction: transaction.data?.toString() ?? "0x",
        };
      },
    );

    const actionsWithFeePaymentAction =
      this.provider._addFeePaymentActionForFeeEstimation(actions);

    const feeEstimate = await this.provider.aggregator.estimateFee(
      this.wallet.sign({
        nonce,
        actions: [...actionsWithFeePaymentAction],
      }),
    );

    const safeFee = addSafetyPremiumToFee(
      BigNumber.from(feeEstimate.feeRequired),
    );

    const actionsWithSafeFee = this.provider._addFeePaymentActionWithSafeFee(
      actions,
      safeFee,
    );

    const bundle = this.wallet.sign({
      nonce,
      actions: [...actionsWithSafeFee],
    });

    return JSON.stringify(bundleToDto(bundle));
  }

  /** Sign a message */
  // TODO: Come back to this once we support EIP-1271
  override async signMessage(message: Bytes | string): Promise<string> {
    await this.initPromise;
    if (isBytes(message)) {
      message = hexlify(message);
    }

    const signedMessage = this.wallet.signMessage(message);
    return RLP.encode(signedMessage);
  }

  override connect(provider: ethers.providers.Provider): BlsSigner {
    throw new Error("cannot alter JSON-RPC Signer connection");
  }

  async _signTypedData(
    domain: any,
    types: Record<string, Array<any>>,
    value: Record<string, any>,
  ): Promise<string> {
    throw new Error("_signTypedData() is not implemented");
  }

  connectUnchecked(): BlsSigner {
    return new UncheckedBlsSigner(
      _constructorGuard,
      this.provider,
      this.wallet?.blsWalletSigner.privateKey ??
        (async (): Promise<string> => {
          await this.initPromise;
          return this.wallet.blsWalletSigner.privateKey;
        })(),
      this._address || this._index,
    );
  }

  async sendUncheckedTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<string> {
    const transactionResponse = await this.sendTransaction(transaction);
    return transactionResponse.hash;
  }

  async _legacySignMessage(message: Bytes | string): Promise<string> {
    throw new Error("_legacySignMessage() is not implemented");
  }

  async _validateBatchOptions(
    batchOptions: BatchOptions,
  ): Promise<BatchOptions> {
    const expectedChainId = await this.getChainId();

    if (batchOptions.chainId !== expectedChainId) {
      throw new Error(
        `Supplied chain ID ${batchOptions.chainId} does not match the expected chain ID ${expectedChainId}`,
      );
    }

    batchOptions.nonce = BigNumber.from(batchOptions.nonce);
    return batchOptions;
  }
}

export class UncheckedBlsSigner extends BlsSigner {
  override async sendTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<ethers.providers.TransactionResponse> {
    await this.initPromise;

    const transactionResponse = await super.sendTransaction(transaction);
    return {
      hash: transactionResponse.hash,
      nonce: 1,
      gasLimit: BigNumber.from(0),
      gasPrice: BigNumber.from(0),
      data: "",
      value: BigNumber.from(0),
      chainId: 0,
      confirmations: 0,
      from: "",
      wait: (confirmations?: number) => {
        return this.provider.waitForTransaction(
          transactionResponse.hash,
          confirmations,
        );
      },
    };
  }
}
