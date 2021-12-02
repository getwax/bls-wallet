import {
  BigNumber,
  BlsWalletSigner,
  BlsWalletWrapper,
  Bundle,
  delay,
  ethers,
  initBlsWalletSigner,
  VerificationGateway,
  // deno-lint-ignore camelcase
  VerificationGateway__factory,
  Wallet,
} from "../../deps.ts";

import * as env from "../env.ts";
import TransactionFailure from "./TransactionFailure.ts";
import assert from "../helpers/assert.ts";
import AppEvent from "./AppEvent.ts";
import toPublicKeyShort from "./helpers/toPublicKeyShort.ts";

export type TxCheckResult = {
  failures: TransactionFailure[];
  nextNonce: BigNumber;
};

export type CreateWalletResult = {
  address?: string;
  failures: TransactionFailure[];
};

export default class EthereumService {
  verificationGateway: VerificationGateway;

  constructor(
    public emit: (evt: AppEvent) => void,
    public wallet: Wallet,
    public blsWalletSigner: BlsWalletSigner,
    verificationGatewayAddress: string,
    public nextNonce: number,
  ) {
    this.verificationGateway = VerificationGateway__factory.connect(
      verificationGatewayAddress,
      this.wallet,
    );
  }

  NextNonce() {
    const result = this.nextNonce++;
    return result;
  }

  static async create(
    emit: (evt: AppEvent) => void,
    verificationGatewayAddress: string,
    aggPrivateKey: string,
  ): Promise<EthereumService> {
    const wallet = EthereumService.Wallet(aggPrivateKey);
    const nextNonce = (await wallet.getTransactionCount());
    const chainId = await wallet.getChainId();
    const blsWalletSigner = await initBlsWalletSigner({ chainId });

    return new EthereumService(
      emit,
      wallet,
      blsWalletSigner,
      verificationGatewayAddress,
      nextNonce,
    );
  }

  async BlockNumber(): Promise<BigNumber> {
    return BigNumber.from(
      await this.wallet.provider.getBlockNumber(),
    );
  }

  async waitForNextBlock() {
    await new Promise((resolve) => {
      this.wallet.provider.once("block", resolve);
    });
  }

  async checkNonces(bundle: Bundle): Promise<TransactionFailure[]> {
    const failures: TransactionFailure[] = [];

    // Not our responsibility to check these are consistent, but we do want to
    // ensure that our indexes are valid.
    const len = Math.min(
      bundle.operations.length,
      bundle.senderPublicKeys.length,
    );

    for (let i = 0; i < len; i++) {
      const nextNonce = await BlsWalletWrapper.Nonce(
        bundle.senderPublicKeys[i],
        this.verificationGateway.address,
        this.wallet,
      );

      if (nextNonce.gt(bundle.operations[i].nonce)) {
        failures.push({
          type: "duplicate-nonce",
          description: [
            `operation ${i}: nonce ${bundle.operations[i].nonce} has already`,
            `been processed (the next nonce for this wallet will be`,
            `${nextNonce.toString()})`,
          ].join(" "),
        });
      }
    }

    return failures;
  }

  async submitBundle(
    bundle: Bundle,
    maxAttempts = 1,
    retryDelay = 300,
  ): Promise<ethers.providers.TransactionReceipt> {
    assert(bundle.operations.length > 0, "Cannot process empty bundle");
    assert(maxAttempts > 0, "Must have at least one attempt");

    const processBundleArgs: Parameters<VerificationGateway["processBundle"]> =
      [
        bundle,
        { nonce: this.NextNonce() },
      ];

    const attempt = async () => {
      let txResponse: ethers.providers.TransactionResponse;

      try {
        txResponse = await this.verificationGateway.processBundle(
          ...processBundleArgs,
        );
      } catch (error) {
        if (/\binvalid transaction nonce\b/.test(error.message)) {
          // This can occur when the nonce is in the future, which can
          // legitimately occur because the previous nonce is still being
          // processed. Therefore we don't treat it like other response errors
          // because it can resolve on its own.
          return { type: "nonceError" as const, value: error };
        }

        // Distinguish this error because it means something bigger is wrong
        // with the transaction and it's not worth retrying.
        return { type: "responseError" as const, value: error };
      }

      try {
        return { type: "receipt" as const, value: await txResponse.wait() };
      } catch (error) {
        return { type: "waitError" as const, value: error };
      }
    };

    const publicKeyShorts = bundle.senderPublicKeys.map(toPublicKeyShort);

    for (let i = 0; i < maxAttempts; i++) {
      this.emit({
        type: "submission-attempt",
        data: { attemptNumber: i + 1, publicKeyShorts },
      });

      const attemptResult = await attempt();

      if (attemptResult.type === "receipt") {
        return attemptResult.value;
      }

      if (attemptResult.type === "responseError") {
        throw attemptResult.value;
      }

      const suspectedTransientError = attemptResult.value;

      if (i !== maxAttempts - 1) {
        this.emit({
          type: "submission-attempt-failed",
          data: {
            attemptNumber: i + 1,
            publicKeyShorts,
            error: suspectedTransientError,
          },
        });

        await delay(retryDelay);
      } else {
        throw suspectedTransientError;
      }
    }

    throw new Error("Expected return or throw from attempt loop");
  }

  private static Wallet(privateKey: string) {
    const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
    const wallet = new Wallet(privateKey, provider);

    if (env.USE_TEST_NET) {
      const originalPopulateTransaction = wallet.populateTransaction
        .bind(
          wallet,
        );

      wallet.populateTransaction = (transaction) => {
        transaction.gasPrice = 0;
        return originalPopulateTransaction(transaction);
      };
    }

    return wallet;
  }
}
