/* eslint-disable camelcase */
import { ethers, BigNumber, Signer, Bytes, BigNumberish } from "ethers";
import {
  AccessListish,
  Deferrable,
  hexlify,
  isBytes,
  RLP,
} from "ethers/lib/utils";

import BlsProvider, { PublicKeyLinkedToActions } from "./BlsProvider";
import BlsWalletWrapper from "./BlsWalletWrapper";
import addSafetyPremiumToFee from "./helpers/addSafetyDivisorToFee";
import { ActionData, bundleToDto } from "./signer";

export const _constructorGuard = {};

/**
 * Based on draft wallet_batchTransactions rpc proposal https://hackmd.io/HFHohGDbRSGgUFI2rk22bA?view
 *
 * @property gas - (THIS PROPERTY IS NOT USED BY BLS WALLET) Transaction gas limit
 * @property maxPriorityFeePerGas - (THIS PROPERTY IS NOT USED BY BLS WALLET) Miner tip aka priority fee
 * @property maxFeePerGas - (THIS PROPERTY IS NOT USED BY BLS WALLET) The maximum total fee per gas the sender is willing to pay (includes the network/base fee and miner/priority fee) in wei
 * @property nonce - Integer of a nonce. This allows overwriting your own pending transactions that use the same nonce
 * @property chainId - Chain ID that this transaction is valid on
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
 * @property transactions - An array of Ethers transaction objects
 * @property batchOptions - Optional batch options taken into account by smart contract wallets. See {@link BatchOptions}
 */
export type TransactionBatch = {
  transactions: Array<ethers.providers.TransactionRequest>;
  batchOptions?: BatchOptions;
};

/**
 * @property transactions - An array of Ethers transaction response objects
 * @property awaitBatchReceipt - A function that returns a promise that resolves to a transaction receipt
 */
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

  /**
   * @param constructorGuard Prevents BlsSigner constructor being called directly
   * @param provider BlsProvider accociated with this signer
   * @param privateKey Private key for the account this signer represents
   * @param addressOrIndex (Not used) Address or index of this account, managed by the connected Ethereum node
   */
  constructor(
    constructorGuard: Record<string, unknown>,
    provider: BlsProvider,
    privateKey: string | Promise<string>,
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

  /** Instantiates a BLS Wallet and then connects the signer to it */
  private async initializeWallet(privateKey: string | Promise<string>) {
    const resolvedPrivateKey = await privateKey;
    this.wallet = await BlsWalletWrapper.connect(
      resolvedPrivateKey,
      this.verificationGatewayAddress,
      this.provider,
    );
  }

  /**
   * Sends transactions to be executed. Converts the TransactionRequest
   * to a bundle and adds it to the aggregator
   *
   * @remarks The transaction hash returned in the transaction response does
   * NOT correspond to a transaction hash that can be viewed on a block
   * explorer. It instead represents the bundle hash, which can be used to
   * get a transaction receipt that has a hash that can be used on a block explorer
   *
   * @param transaction Transaction request object
   * @returns A transaction response object that can be awaited to get the transaction receipt
   */
  override async sendTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<ethers.providers.TransactionResponse> {
    await this.initPromise;

    if (!transaction.to) {
      throw new TypeError("Transaction.to should be defined");
    }

    const validatedTransaction = await this._validateTransaction(transaction);

    const nonce = await BlsWalletWrapper.Nonce(
      this.wallet.PublicKey(),
      this.verificationGatewayAddress,
      this.provider,
    );

    const action: ActionData = {
      ethValue: validatedTransaction.value?.toString() ?? "0",
      contractAddress: validatedTransaction.to!.toString(),
      encodedFunction: validatedTransaction.data?.toString() ?? "0x",
    };

    const feeEstimate = await this.provider.estimateGas(validatedTransaction);
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

    return await this.provider._constructTransactionResponse(
      action,
      bundle.senderPublicKeys[0],
      result.hash,
      nonce,
    );
  }

  /**
   * @param transactionBatch A transaction batch object
   * @returns A transaction batch response object that can be awaited to get the transaction receipt
   */
  async sendTransactionBatch(
    transactionBatch: TransactionBatch,
  ): Promise<TransactionBatchResponse> {
    await this.initPromise;

    const validatedTransactionBatch = await this._validateTransactionBatch(
      transactionBatch,
    );

    let nonce: BigNumber;
    if (transactionBatch.batchOptions) {
      nonce = validatedTransactionBatch.batchOptions!.nonce as BigNumber;
    } else {
      nonce = await BlsWalletWrapper.Nonce(
        this.wallet.PublicKey(),
        this.verificationGatewayAddress,
        this.provider,
      );
    }

    const actions: Array<ActionData> = transactionBatch.transactions.map(
      (transaction) => {
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

    const publicKeysLinkedToActions: Array<PublicKeyLinkedToActions> =
      bundle.senderPublicKeys.map((publicKey, i) => {
        const operation = bundle.operations[i];
        const actions = operation.actions;

        return {
          publicKey,
          actions,
        };
      });

    return await this.provider._constructTransactionBatchResponse(
      publicKeysLinkedToActions,
      result.hash,
      nonce,
    );
  }

  /**
   * @returns The address associated with the BlsSigner
   */
  async getAddress(): Promise<string> {
    await this.initPromise;
    if (this._address) {
      return this._address;
    }

    this._address = this.wallet.address;
    return this._address;
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

  /**
   * @remarks Signs a transaction that can be executed by the BlsProvider
   *
   * @param transaction Transaction request object
   * @returns A signed bundle as a string
   */
  override async signTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<string> {
    await this.initPromise;

    const validatedTransaction = await this._validateTransaction(transaction);

    const action: ActionData = {
      ethValue: validatedTransaction.value?.toString() ?? "0",
      contractAddress: validatedTransaction.to!.toString(),
      encodedFunction: validatedTransaction.data?.toString() ?? "0x",
    };

    const nonce = await BlsWalletWrapper.Nonce(
      this.wallet.PublicKey(),
      this.verificationGatewayAddress,
      this.provider,
    );

    const feeEstimate = await this.provider.estimateGas(validatedTransaction);

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

  /**
   * Signs a transaction batch that can be executed by the BlsProvider
   *
   * @param transactionBatch A transaction batch object
   * @returns A signed bundle containing all transactions from the transaction batch as a string
   */
  async signTransactionBatch(
    transactionBatch: TransactionBatch,
  ): Promise<string> {
    await this.initPromise;

    const validatedTransactionBatch = await this._validateTransactionBatch(
      transactionBatch,
    );

    let nonce: BigNumber;
    if (transactionBatch.batchOptions) {
      nonce = validatedTransactionBatch.batchOptions!.nonce as BigNumber;
    } else {
      nonce = await BlsWalletWrapper.Nonce(
        this.wallet.PublicKey(),
        this.verificationGatewayAddress,
        this.provider,
      );
    }

    const actions: Array<ActionData> = transactionBatch.transactions.map(
      (transaction) => {
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

  /** Signs a message */
  // TODO: bls-wallet #201 Come back to this once we support EIP-1271
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

  /**
   * @returns A new Signer object which does not perform additional checks when sending a transaction
   */
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

  /**
   * @param transaction Transaction request object
   * @returns Transaction hash for the transaction, corresponds to a bundle hash
   */
  async sendUncheckedTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<string> {
    const transactionResponse = await this.sendTransaction(transaction);
    return transactionResponse.hash;
  }

  async _legacySignMessage(message: Bytes | string): Promise<string> {
    throw new Error("_legacySignMessage() is not implemented");
  }

  async _validateTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<ethers.providers.TransactionRequest> {
    const resolvedTransaction = await ethers.utils.resolveProperties(
      transaction,
    );

    if (!resolvedTransaction.to) {
      throw new TypeError("Transaction.to should be defined");
    }

    if (!resolvedTransaction.from) {
      resolvedTransaction.from = await this.getAddress();
    }

    return resolvedTransaction;
  }

  async _validateTransactionBatch(
    transactionBatch: TransactionBatch,
  ): Promise<TransactionBatch> {
    const signerAddress = await this.getAddress();

    const validatedTransactions: Array<ethers.providers.TransactionRequest> =
      transactionBatch.transactions.map((transaction, i) => {
        if (!transaction.to) {
          throw new TypeError(`Transaction.to is missing on transaction ${i}`);
        }

        if (!transaction.from) {
          transaction.from = signerAddress;
        }

        return {
          ...transaction,
        };
      });

    const validatedBatchOptions = transactionBatch.batchOptions
      ? await this._validateBatchOptions(transactionBatch.batchOptions)
      : transactionBatch.batchOptions;

    return {
      transactions: validatedTransactions,
      batchOptions: validatedBatchOptions,
    };
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
  /**
   * As with other transaction methods, the transaction hash returned represents the bundle hash, NOT a transaction hash you can use on a block explorer
   *
   * @param transaction Transaction request object
   * @returns The transaction response object with only the transaction hash property populated with a valid value
   */
  override async sendTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<ethers.providers.TransactionResponse> {
    await this.initPromise;

    const transactionResponse = await super.sendTransaction(transaction);
    return {
      hash: transactionResponse.hash,
      nonce: NaN,
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
