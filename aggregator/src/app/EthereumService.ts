import {
  AggregatorUtilities,
  AggregatorUtilitiesFactory,
  BaseContract,
  BigNumber,
  BlsWalletSigner,
  BlsWalletWrapper,
  Bundle,
  BytesLike,
  delay,
  ethers,
  initBlsWalletSigner,
  VerificationGateway,
  VerificationGatewayFactory,
  Wallet,
} from "../../deps.ts";

import * as env from "../env.ts";
import TransactionFailure from "./TransactionFailure.ts";
import assert from "../helpers/assert.ts";
import AppEvent from "./AppEvent.ts";
import toPublicKeyShort from "./helpers/toPublicKeyShort.ts";
import AsyncReturnType from "../helpers/AsyncReturnType.ts";
import ExplicitAny from "../helpers/ExplicitAny.ts";
import nil from "../helpers/nil.ts";

export type TxCheckResult = {
  failures: TransactionFailure[];
  nextNonce: BigNumber;
};

export type CreateWalletResult = {
  address?: string;
  failures: TransactionFailure[];
};

type Call = Parameters<
  AggregatorUtilities["callStatic"]["performSequence"]
>[0][number];

type CallHelper<T> = {
  value: Call;
  resultDecoder: (result: BytesLike) => T;
};

type CallResult<T> =
  | { success: true; returnValue: T }
  | { success: false; returnValue: undefined };

type MapCallHelperReturns<T> = T extends CallHelper<unknown>[]
  ? (T extends [CallHelper<infer First>, ...infer Rest]
    ? [CallResult<First>, ...MapCallHelperReturns<Rest>]
    : [])
  : never;

// It appears that ethers' callStatic with unwrap single element arrays.
// However, when passing the bytes into decodeFunctionResult, this unwrap
// doesn't happen. The result is always an array, so we can fix this
// inconsistency by wrapping the type in an array if it's not already an array.
type EnforceArray<T> = T extends unknown[] ? T : [T];

type DecodeReturnType<
  Contract extends BaseContract,
  Method extends keyof Contract["callStatic"],
> = EnforceArray<AsyncReturnType<Contract["callStatic"][Method]>>;

export default class EthereumService {
  verificationGateway: VerificationGateway;
  utilities: AggregatorUtilities;

  constructor(
    public emit: (evt: AppEvent) => void,
    public wallet: Wallet,
    public provider: ethers.providers.Provider,
    public blsWalletWrapper: BlsWalletWrapper,
    public blsWalletSigner: BlsWalletSigner,
    verificationGatewayAddress: string,
    utilitiesAddress: string,
    public nextNonce: BigNumber,
  ) {
    this.verificationGateway = VerificationGatewayFactory.connect(
      verificationGatewayAddress,
      this.wallet,
    );

    this.utilities = AggregatorUtilitiesFactory.connect(
      utilitiesAddress,
      this.wallet,
    );
  }

  NextNonce() {
    const result = this.nextNonce;
    this.nextNonce = this.nextNonce.add(1);
    return result;
  }

  static async create(
    emit: (evt: AppEvent) => void,
    verificationGatewayAddress: string,
    utilitiesAddress: string,
    aggPrivateKey: string,
  ): Promise<EthereumService> {
    const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
    provider.pollingInterval = env.RPC_POLLING_INTERVAL;
    const wallet = EthereumService.Wallet(provider, aggPrivateKey);

    const blsWalletWrapper = await BlsWalletWrapper.connect(
      aggPrivateKey,
      verificationGatewayAddress,
      provider,
    );

    const blsNonce = await blsWalletWrapper.Nonce();

    if (blsNonce.eq(0)) {
      if (!env.AUTO_CREATE_INTERNAL_BLS_WALLET) {
        throw new Error([
          "Required internal bls wallet does not exist. Either enable",
          "AUTO_CREATE_INTERNAL_BLS_WALLET or run",
          "./programs/createInternalBlsWallet.ts",
        ].join(" "));
      }

      await (await VerificationGatewayFactory.connect(
        verificationGatewayAddress,
        wallet,
      ).processBundle(
        await blsWalletWrapper.signWithGasEstimate({
          nonce: 0,
          actions: [],
        }),
      )).wait();
    }

    const nextNonce = BigNumber.from(await wallet.getTransactionCount());
    const chainId = await wallet.getChainId();
    const blsWalletSigner = await initBlsWalletSigner({
      chainId,
      privateKey: aggPrivateKey,
    });

    return new EthereumService(
      emit,
      wallet,
      provider,
      blsWalletWrapper,
      blsWalletSigner,
      verificationGatewayAddress,
      utilitiesAddress,
      nextNonce,
    );
  }

  async BlockNumber(): Promise<BigNumber> {
    return BigNumber.from(
      await this.provider.getBlockNumber(),
    );
  }

  // TODO (merge-ok): Consider: We may want to fail operations
  // that are not at the next expected nonce, including all
  // current pending transactions for that wallet.
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

  Call<
    Contract extends BaseContract,
    Method extends keyof Contract["callStatic"],
  >(
    contract: Contract,
    method: Method,
    args: Parameters<Contract["callStatic"][Method]>,
  ): CallHelper<DecodeReturnType<Contract, Method>> {
    return {
      value: {
        contractAddress: contract.address,
        encodedFunction: contract.interface.encodeFunctionData(
          method as ExplicitAny,
          args,
        ),
      },
      resultDecoder: (data) =>
        contract.interface.decodeFunctionResult(
          method as ExplicitAny,
          data,
        ) as DecodeReturnType<Contract, Method>,
    };
  }

  async callStaticSequence<Calls extends CallHelper<unknown>[]>(
    ...calls: Calls
  ): Promise<MapCallHelperReturns<Calls>> {
    const rawResults = await this.utilities.callStatic.performSequence(
      calls.map((c) => c.value),
    );

    const results: CallResult<unknown>[] = rawResults.map(
      ([success, result], i) => {
        if (!success) {
          return { success };
        }

        return {
          success,
          returnValue: calls[i].resultDecoder(result),
        };
      },
    );

    return results as MapCallHelperReturns<Calls>;
  }

  async callStaticSequenceWithMeasure<Measure, CallReturn>(
    measureCall: CallHelper<Measure>,
    calls: CallHelper<CallReturn>[],
  ): Promise<{
    measureResults: CallResult<Measure>[];
    callResults: CallResult<CallReturn>[];
  }> {
    const fullCalls: CallHelper<unknown>[] = [measureCall];

    for (const call of calls) {
      fullCalls.push(call, measureCall);
    }

    const fullResults: CallResult<unknown>[] = await this.callStaticSequence(
      ...fullCalls,
    );

    const measureResults: CallResult<unknown>[] = fullResults.filter(
      (_r, i) => i % 2 === 0,
    );

    const callResults = fullResults.filter(
      (_r, i) => i % 2 === 1,
    );

    return {
      measureResults: measureResults as CallResult<Measure>[],
      callResults: callResults as CallResult<CallReturn>[],
    };
  }

  async checkBundle(bundle: Bundle) {
    try {
      const { successes } = await this.verificationGateway.callStatic
        .processBundle(bundle);
      // All operations in the bundle should be estimated to succeed.
      return successes.every((suc) => suc);
    } catch {
      return false;
    }
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
        {
          nonce: this.NextNonce(),
          ...await this.GasConfig(),
        },
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

  async GasConfig() {
    const block = await this.provider.getBlock("latest");
    const previousBaseFee = block.baseFeePerGas;
    assert(previousBaseFee !== null && previousBaseFee !== nil);

    // Increase the basefee we're willing to pay to improve the chance of our
    // transaction getting included. As per EIP-1559, we only pay the actual
    // basefee anyway, *but* we also pass this fee onto users which don't have
    // this benefit (they'll pay regardless of where basefee lands).
    //
    // This means there's a tradeoff here - low values risk our transactions not
    // being included, high values pass on unnecessary fees to users.
    //
    const baseFeeIncrease = previousBaseFee.mul(
      env.PREVIOUS_BASE_FEE_PERCENT_INCREASE,
    ).div(100);

    return {
      maxFeePerGas: previousBaseFee
        .add(baseFeeIncrease)
        // Remember that basefee is burned, not provided to miners. Miners
        // *only* get the priority fee, so they have no reason to care about our
        // transaction if the priority fee is zero.
        .add(env.PRIORITY_FEE_PER_GAS),
      maxPriorityFeePerGas: env.PRIORITY_FEE_PER_GAS,
    };
  }

  private static Wallet(
    provider: ethers.providers.Provider,
    privateKey: string,
  ) {
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
