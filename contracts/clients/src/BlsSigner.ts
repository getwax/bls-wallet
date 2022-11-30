import { ethers, BigNumber, Signer, Bytes } from "ethers";
import { Deferrable } from "ethers/lib/utils";

import BlsProvider from "./BlsProvider";
import BlsWalletWrapper from "./BlsWalletWrapper";
import { ActionData, Bundle, Signature } from "./signer";

export const _constructorGuard = {};

export default class BlsSigner extends Signer {
  override readonly provider: BlsProvider;
  readonly verificationGatewayAddress!: string;
  wallet!: BlsWalletWrapper;
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
        "do not call the BlsSigner constructor directly; use provider.getSigner.",
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
        invalid address or index. addressOrIndex: ${addressOrIndex}.`);
    }
  }

  async initWallet(privateKey: string) {
    this.wallet = await BlsWalletWrapper.connect(
      privateKey,
      this.verificationGatewayAddress,
      this.provider,
    );
  }

  override async sendTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<ethers.providers.TransactionResponse> {
    this.#verifyInit();

    if (!transaction.to) {
      throw new TypeError("Transaction.to should be defined.");
    }

    // TODO: bls-wallet #375 Add multi-action transactions to BlsProvider & BlsSigner
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

    const bundle = this.wallet.sign({ nonce, actions: [action] });
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

  async getAddress(): Promise<string> {
    this.#verifyInit();
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
    this.#verifyInit();
    const chainId = await this.getChainId();
    if (!nonce) {
      nonce = await BlsWalletWrapper.Nonce(
        this.wallet.PublicKey(),
        this.verificationGatewayAddress,
        this.provider,
      );
    }

    // TODO: bls-wallet #412 Update values returned in bundle receipt to more closely match ethers transaction response
    return {
      hash,
      to: action.contractAddress,
      from,
      nonce: BigNumber.from(nonce).toNumber(),
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
    throw new Error(
      "signTransaction() is not implemented, call 'signBlsTransaction()' instead.",
    );
  }

  async signBlsTransaction(action: ActionData): Promise<Bundle> {
    this.#verifyInit();
    const nonce = await BlsWalletWrapper.Nonce(
      this.wallet.PublicKey(),
      this.verificationGatewayAddress,
      this,
    );

    return this.wallet.sign({ nonce, actions: [action] });
  }

  override async signMessage(message: Bytes | string): Promise<string> {
    throw new Error("signMessage() is not implemented.");
  }

  /** Sign a message */
  signBlsMessage(message: string): Signature {
    this.#verifyInit();
    return this.wallet.signMessage(message);
  }

  override connect(provider: ethers.providers.Provider): BlsSigner {
    throw new Error("connect() is not implemented.");
  }

  async _signTypedData(
    domain: any,
    types: Record<string, Array<any>>,
    value: Record<string, any>,
  ): Promise<string> {
    throw new Error("_signTypedData() is not implemented.");
  }

  connectUnchecked(): ethers.providers.JsonRpcSigner {
    throw new Error("connectUnchecked() is not implemented.");
  }

  async sendUncheckedTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<string> {
    throw new Error("sendUncheckedTransaction() is not implemented.");
  }

  async _legacySignMessage(message: Bytes | string): Promise<string> {
    throw new Error("_legacySignMessage() is not implemented.");
  }

  #verifyInit = () => {
    if (!this.wallet || !this.verificationGatewayAddress) {
      throw new Error(
        "To perform this operation, ensure you have instantiated a BlsSigner and have called this.init() to initialize the wallet.",
      );
    }
  };
}
