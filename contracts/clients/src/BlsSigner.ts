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
import { ActionDataDto, Bundle } from "./signer/types";

export const _constructorGuard = {};

export default class BlsSigner extends Signer {
  readonly provider: BlsProvider;
  wallet!: BlsWalletWrapper; // TODO: Add checks to ensure property is initialised before use
  verificationGatewayAddress!: string; // TODO: Add checks to ensure property is initialised before use
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
    try {
      const provider = this.provider;

      // Converts an ethers transactionRequest to a BLS Wallet ActionDataDto
      const action: ActionDataDto = {
        ethValue: transaction.value?.toString() ?? "0",
        contractAddress: transaction.to?.toString()!, // TODO: Unsure about this... should we be stating something is nullable then telling the compiler it's not???
        encodedFunction: transaction.data?.toString() ?? "0x",
      };

      const nonce = (
        await BlsWalletWrapper.Nonce(
          this.wallet.PublicKey(),
          this.verificationGatewayAddress,
          provider,
        )
      ).toString();

      const bundle = this.wallet.sign({ nonce, actions: [action] });
      const agg = provider.aggregator;
      const result = await agg.add(bundle);

      if ("failures" in result) {
        throw new Error(result.failures.join("\n"));
      }

      return this.constructTransactionResponse(
        action,
        result.hash,
        this.wallet.address,
        nonce,
      );
    } catch (error) {
      throw new Error(
        `BlsSigner "sendTransaction()" - error sending transaction: ${error}`,
      );
    }
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
    action: ActionDataDto,
    hash: string,
    from: string,
    nonce?: string,
  ): Promise<TransactionResponse> {
    this.#verifyInit();
    const chainId = await this.getChainId();
    if (!nonce) {
      nonce = (
        await BlsWalletWrapper.Nonce(
          this.wallet.PublicKey(),
          this.verificationGatewayAddress,
          this.provider,
        )
      ).toString();
    }
    return {
      hash,
      confirmations: 1,
      from,
      nonce: BigNumber.from(nonce).toNumber(),
      gasLimit: BigNumber.from("0x0"), // TODO: Should this value be calculated?
      value: BigNumber.from(action.ethValue),
      data: action.encodedFunction,
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
  async signBlsTransaction(action: ActionDataDto): Promise<Bundle> {
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

  // NON IMPLEMENTED METHODS
  connect(provider: Provider): BlsSigner {
    throw new Error("changing providers is not supported");
  }

  connectUnchecked(): JsonRpcSigner {
    throw new Error("UncheckedJsonRpcSigner is not supported");
  }

  sendUncheckedTransaction(
    transaction: Deferrable<TransactionRequest>,
  ): Promise<string> {
    throw new Error("sendUncheckedTransaction is not supported");
  }

  async signMessage(message: Bytes | string): Promise<string> {
    throw new Error(
      "signMessage(message: Bytes | string): Promise<string> not implemented",
    );
  }

  async signTransaction(
    transaction: Deferrable<TransactionRequest>,
  ): Promise<string> {
    throw new Error(
      "signTransaction is not supported, use 'signBlsTransaction(action: ActionDataDto): Promise<Bundle>' instead",
    );
  }

  async _legacySignMessage(message: Bytes | string): Promise<string> {
    throw new Error("_legacySignMessage is not supported");
  }

  async _signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>,
  ): Promise<string> {
    throw new Error("_signTypedData is not supported");
  }

  #verifyInit = () => {
    if (!this.wallet || !this.verificationGatewayAddress) {
      throw new Error("Call this.init() to initialize the wallet.");
    }
  };
}
