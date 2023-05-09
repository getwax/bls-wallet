/* eslint-disable camelcase */
import { ethers, BigNumber } from "ethers";
import { Deferrable } from "ethers/lib/utils";

import { ActionData, Bundle, PublicKey } from "./signer/types";
import Aggregator, { BundleReceipt } from "./Aggregator";
import BlsSigner, {
  TransactionBatchResponse,
  // Used for sendTransactionBatch TSdoc comment
  // eslint-disable-next-line no-unused-vars
  TransactionBatch,
  UncheckedBlsSigner,
  _constructorGuard,
} from "./BlsSigner";
import poll from "./helpers/poll";
import BlsWalletWrapper from "./BlsWalletWrapper";
import {
  AggregatorUtilities__factory,
  BLSWallet__factory,
  VerificationGateway__factory,
} from "../typechain-types";
import addSafetyPremiumToFee from "./helpers/addSafetyDivisorToFee";

/** Public key linked to actions parsed from a bundle */
export type PublicKeyLinkedToActions = {
  publicKey: PublicKey;
  actions: Array<ActionData>;
};

export default class BlsProvider extends ethers.providers.JsonRpcProvider {
  readonly aggregator: Aggregator;
  readonly verificationGatewayAddress: string;
  readonly aggregatorUtilitiesAddress: string;

  /**
   * @param aggregatorUrl The url for an aggregator instance
   * @param verificationGatewayAddress Verification gateway contract address
   * @param aggregatorUtilitiesAddress Aggregator utilities contract address
   * @param url Rpc url
   * @param network The network the provider should connect to
   */
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

  /**
   * @param transaction Transaction request object
   * @returns An estimate of the amount of gas that would be required to submit the transaction to the network
   */
  override async estimateGas(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<BigNumber> {
    const resolvedTransaction = await ethers.utils.resolveProperties(
      transaction,
    );

    if (!resolvedTransaction.to) {
      throw new TypeError("Transaction.to should be defined");
    }
    if (!resolvedTransaction.from) {
      throw new TypeError("Transaction.from should be defined");
    }

    const action: ActionData = {
      ethValue: resolvedTransaction.value?.toString() ?? "0",
      contractAddress: resolvedTransaction.to.toString(),
      encodedFunction: resolvedTransaction.data?.toString() ?? "0x",
    };

    // set to zero at all times as an error will be thrown. If the
    // nonce of the actual wallet is more than 0, there will be a
    // nonce mistmatch as signWithGasEstimate with check the operation
    // nonce against the throwawayBlsWalletWrapper nonce, which is always zero
    const nonce = 0;

    const actionWithFeePaymentAction =
      this._addFeePaymentActionForFeeEstimation([action]);

    // TODO: (merge-ok) bls-wallet #560 Estimate fee without requiring a signed bundle
    // There is no way to estimate the cost of a bundle without signing a bundle. The
    // alternative would be to use a signer instance in this method which is undesirable,
    // as this would result in tight coupling between a provider and a signer.
    const throwawayPrivateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();
    const throwawayBlsWalletWrapper = await BlsWalletWrapper.connect(
      throwawayPrivateKey,
      this.verificationGatewayAddress,
      this,
    );

    const bundle = await throwawayBlsWalletWrapper.signWithGasEstimate({
      nonce,
      actions: [...actionWithFeePaymentAction],
    });

    const feeEstimate = await this.aggregator.estimateFee(bundle);

    const feeRequired = BigNumber.from(feeEstimate.feeRequired);
    return addSafetyPremiumToFee(feeRequired);
  }

  /**
   * Sends transaction to be executed. Adds the signed bundle to the aggregator
   *
   * @param signedTransaction A signed bundle
   * @returns A transaction response object that can be awaited to get the transaction receipt
   */
  override async sendTransaction(
    signedTransaction: string | Promise<string>,
  ): Promise<ethers.providers.TransactionResponse> {
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

    return await this._constructTransactionResponse(
      actionData,
      bundle.senderPublicKeys[0],
      result.hash,
    );
  }

  /**
   * @param signedTransactionBatch A signed {@link TransactionBatch}
   * @returns A transaction batch response object that can be awaited to get the transaction receipt
   */
  async sendTransactionBatch(
    signedTransactionBatch: string,
  ): Promise<TransactionBatchResponse> {
    const bundle: Bundle = JSON.parse(signedTransactionBatch);

    const result = await this.aggregator.add(bundle);

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

    return await this._constructTransactionBatchResponse(
      publicKeysLinkedToActions,
      result.hash,
    );
  }

  /**
   * @param privateKey Private key for the account the signer represents
   * @param addressOrIndex (Not Used) address or index of the account, managed by the connected Ethereum node
   * @returns A new BlsSigner instance
   */
  override getSigner(
    privateKey: string,
    addressOrIndex?: string | number,
  ): BlsSigner {
    return new BlsSigner(_constructorGuard, this, privateKey, addressOrIndex);
  }

  /**
   * @param privateKey Private key for the account the signer represents
   * @param addressOrIndex (Not Used) address or index of the account, managed by the connected Ethereum node
   * @returns A new UncheckedBlsSigner instance
   */
  override getUncheckedSigner(
    privateKey: string,
    addressOrIndex?: string,
  ): UncheckedBlsSigner {
    return this.getSigner(privateKey, addressOrIndex).connectUnchecked();
  }

  /**
   * Gets the transaction receipt associated with the transaction (bundle) hash
   *
   * @remarks The transaction hash argument corresponds to a bundle hash and cannot be used on a block explorer.
   * Instead, the transaction hash returned in the transaction receipt from this method can be used in a block explorer.
   *
   * @param transactionHash The transaction hash returned from the BlsProvider and BlsSigner sendTransaction methods. This is technically a bundle hash
   * @returns The transaction receipt that corressponds to the transaction hash (bundle hash)
   */
  override async getTransactionReceipt(
    transactionHash: string | Promise<string>,
  ): Promise<ethers.providers.TransactionReceipt> {
    const resolvedTransactionHash = await transactionHash;
    return this._getTransactionReceipt(resolvedTransactionHash, 1, 20);
  }

  /**
   * Gets the transaction receipt associated with the transaction (bundle) hash
   *
   * @remarks The transaction hash argument cannot be used on a block explorer. It instead corresponds to a bundle hash.
   * The transaction hash returned in the transaction receipt from this method can be used in a block explorer.
   *
   * @param transactionHash The transaction hash returned from sending a transaction. This is technically a bundle hash
   * @param confirmations (Not used) the number of confirmations to wait for before returning the transaction receipt
   * @param retries The number of retries to poll the receipt for
   * @returns
   */
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

  /**
   * @param address The address that the method gets the transaction count from
   * @param blockTag The specific block tag to get the transaction count from
   * @returns The number of transactions an account has sent
   */
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
        ethValue: fee.toHexString(),
        contractAddress: this.aggregatorUtilitiesAddress,
        encodedFunction:
          aggregatorUtilitiesContract.interface.encodeFunctionData(
            "sendEthToTxOrigin",
          ),
      },
    ];
  }

  async _constructTransactionResponse(
    action: ActionData,
    publicKey: PublicKey,
    hash: string,
    nonce?: BigNumber,
  ): Promise<ethers.providers.TransactionResponse> {
    const chainId = await this.send("eth_chainId", []);

    if (!nonce) {
      nonce = await BlsWalletWrapper.Nonce(
        publicKey,
        this.verificationGatewayAddress,
        this,
      );
    }

    const verificationGateway = VerificationGateway__factory.connect(
      this.verificationGatewayAddress,
      this,
    );
    const from = await BlsWalletWrapper.AddressFromPublicKey(
      publicKey,
      verificationGateway,
    );

    return {
      hash,
      to: action.contractAddress,
      from,
      nonce: nonce.toNumber(),
      gasLimit: BigNumber.from("0x0"),
      data: action.encodedFunction.toString(),
      value: BigNumber.from(action.ethValue),
      chainId: parseInt(chainId, 16),
      type: 2,
      confirmations: 1,
      wait: (confirmations?: number) => {
        return this.waitForTransaction(hash, confirmations);
      },
    };
  }

  async _constructTransactionBatchResponse(
    publicKeysLinkedToActions: Array<PublicKeyLinkedToActions>,
    hash: string,
    nonce?: BigNumber,
  ): Promise<TransactionBatchResponse> {
    const chainId = await this.send("eth_chainId", []);
    const verificationGateway = VerificationGateway__factory.connect(
      this.verificationGatewayAddress,
      this,
    );

    const transactions: Array<ethers.providers.TransactionResponse> = [];

    for (const publicKeyLinkedToActions of publicKeysLinkedToActions) {
      const from = await BlsWalletWrapper.AddressFromPublicKey(
        publicKeyLinkedToActions.publicKey,
        verificationGateway,
      );

      if (!nonce) {
        nonce = await BlsWalletWrapper.Nonce(
          publicKeyLinkedToActions.publicKey,
          this.verificationGatewayAddress,
          this,
        );
      }

      for (const action of publicKeyLinkedToActions.actions) {
        if (action.contractAddress === this.aggregatorUtilitiesAddress) {
          break;
        }

        transactions.push({
          hash,
          to: action.contractAddress,
          from,
          nonce: nonce!.toNumber(),
          gasLimit: BigNumber.from("0x0"),
          data: action.encodedFunction.toString(),
          value: BigNumber.from(action.ethValue),
          chainId: parseInt(chainId, 16),
          type: 2,
          confirmations: 1,
          wait: (confirmations?: number) => {
            return this.waitForTransaction(hash, confirmations);
          },
        });
      }
    }

    return {
      transactions,
      awaitBatchReceipt: (confirmations?: number) => {
        return this.waitForTransaction(hash, confirmations);
      },
    };
  }
}
