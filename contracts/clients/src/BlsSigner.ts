import { JsonRpcSigner } from "@ethersproject/providers";
import {
  TransactionResponse,
  TransactionRequest,
  Provider,
} from "@ethersproject/abstract-provider";
import {
  Signer,
  TypedDataDomain,
  TypedDataField,
} from "@ethersproject/abstract-signer";
import { Bytes } from "@ethersproject/bytes";
import { Deferrable } from "@ethersproject/properties";
import { BigNumber } from "@ethersproject/bignumber";

import BlsProvider from "./BlsProvider";
import BlsWalletWrapper from "./BlsWalletWrapper";
import { ActionData, Bundle } from "./signer/types";

export const _constructorGuard = {};

export default class BlsSigner extends Signer {
  readonly provider: BlsProvider;
  wallet!: BlsWalletWrapper;
  verificationGatewayAddress!: string;
  _index: number;
  _address: string;

  constructor(
    constructorGuard: any,
    provider: BlsProvider,
    readonly addressOrIndex?: string | number,
  ) {
    super();
    this.provider = provider;
    this.verificationGatewayAddress = this.provider.verificationGatewayAddress;

    if (constructorGuard !== _constructorGuard) {
      throw new Error(
        "do not call the BlsSigner constructor directly; use provider.getSigner",
      );
    }

    if (addressOrIndex == null) {
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

  async initWallet(privateKey: string) {
    this.wallet = await BlsWalletWrapper.connect(
      privateKey,
      this.verificationGatewayAddress,
      this.provider,
    );
  }

  async sendTransaction(
    transaction: Deferrable<TransactionRequest>,
  ): Promise<TransactionResponse> {
    this.#verifyInit();
    const provider = this.provider;

    // Converts an ethers transactionRequest to a BLS Wallet ActionData
    const action: ActionData = {
      ethValue: transaction.value?.toString() ?? "0",
      contractAddress: transaction.to?.toString()!, // TODO: Unsure about this... should we be stating something is nullable then telling the compiler it's not???
      encodedFunction: transaction.data?.toString() ?? "0x",
    };

    const nonce = await BlsWalletWrapper.Nonce(
      this.wallet.PublicKey(),
      this.verificationGatewayAddress,
      provider,
    );

    const bundle = this.wallet.sign({ nonce, actions: [action] });
    const agg = provider.aggregator;
    const result = await agg.add(bundle);

    if ("failures" in result) {
      throw new Error(
        JSON.stringify(
          result.failures
            .map((failure) => {
              return `${failure.description}`;
            })
            .join("\n"),
        ),
      );
    }

    return this.constructTransactionResponse(
      action,
      result.hash,
      this.wallet.address,
      nonce,
    );
  }

  async getAddress(): Promise<string> {
    this.#verifyInit();
    if (this._address) {
      return this._address;
    }

    this._address = this.wallet.address;
    return this._address;
  }

  // Construct a response following the ethers interface
  async constructTransactionResponse(
    action: ActionData,
    hash: string,
    from: string,
    nonce?: BigNumber,
  ): Promise<TransactionResponse> {
    this.#verifyInit();
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
      confirmations: 1,
      from,
      nonce: BigNumber.from(nonce).toNumber(),
      gasLimit: BigNumber.from("0x0"),
      value: BigNumber.from(action.ethValue),
      data: action.encodedFunction.toString(),
      chainId: chainId,
      wait: (confirmations?: number) => {
        return this.provider.waitForTransaction(hash, confirmations);
      },
    };
  }

  async unlock(password: string): Promise<boolean> {
    const provider = this.provider;

    const address = await this.getAddress();

    return provider.send("personal_unlockAccount", [
      address.toLowerCase(),
      password,
      null,
    ]);
  }

  // TODO: JsonRpcSigner does not implement this method so should we do the same thing? Issue is it is used by the sendTransaction() method in the provider
  async signBlsTransaction(action: ActionData): Promise<Bundle> {
    this.#verifyInit();
    const nonce = (
      await BlsWalletWrapper.Nonce(
        this.wallet.PublicKey(),
        this.verificationGatewayAddress,
        this,
      )
    ).toString();

    return this.wallet.sign({ nonce, actions: [action] });
  }

  // // UN-IMPLEMENTED METHODS
  connect(provider: Provider): BlsSigner {
    throw new Error("connect() is not implemented");
  }

  async signMessage(message: Bytes | string): Promise<string> {
    throw new Error("signMessage() is not implemented");
  }

  async signTransaction(
    transaction: Deferrable<TransactionRequest>,
  ): Promise<string> {
    throw new Error(
      "signTransaction() is not implemented, call 'signBlsTransaction()' instead",
    );
  }

  async _signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>,
  ): Promise<string> {
    throw new Error("_signTypedData() is not implemented");
  }

  connectUnchecked(): JsonRpcSigner {
    throw new Error("connectUnchecked() is not implemented");
  }

  sendUncheckedTransaction(
    transaction: Deferrable<TransactionRequest>,
  ): Promise<string> {
    throw new Error("sendUncheckedTransaction() is not implemented");
  }

  async _legacySignMessage(message: Bytes | string): Promise<string> {
    throw new Error("_legacySignMessage() is not implemented");
  }

  // TODO: Why is this cause the tests to fail on blsSigner.initWallet()???????
  // checkTransaction(
  //   transaction: Deferrable<TransactionRequest>,
  // ): Deferrable<TransactionRequest> {
  //   throw new Error("checkTransaction() is not implemented");
  // }

  async populateTransaction(
    transaction: Deferrable<TransactionRequest>,
  ): Promise<TransactionRequest> {
    throw new Error("populateTransaction() is not implemented");
  }

  #verifyInit = () => {
    if (!this.wallet || !this.verificationGatewayAddress) {
      throw new Error(
        "To perform this operation, ensure you have instantiated a BlsSigner and have called this.init() to initialize the wallet.",
      );
    }
  };
}
