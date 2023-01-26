import nodeFetch from "node-fetch";
import { ContractReceipt } from "ethers";
import { Bundle, bundleToDto } from "./signer";

// TODO: Rename to BundleFailure?
type TransactionFailure =
  | { type: "invalid-format"; description: string }
  | { type: "invalid-signature"; description: string }
  | { type: "duplicate-nonce"; description: string }
  | { type: "insufficient-reward"; description: string }
  | { type: "unpredictable-gas-limit"; description: string }
  | { type: "invalid-creation"; description: string };

export type ActionDataDto = {
  ethValue: string;
  contractAddress: string;
  encodedFunction: string;
};

export type OperationDto = {
  nonce: string;
  actions: ActionDataDto[];
};

export type BundleDto = {
  senderPublicKeys: [string, string, string, string][];
  operations: OperationDto[];
  signature: [string, string];
};

export type EstimateFeeResponse = {
  feeType: string;
  feeDetected: string;
  feeRequired: string;
  successes: boolean[];
};

export type BundleReceiptError = {
  submitError: string | undefined;
};

/**
 * The BLS Wallet specific values in a {@link BundleReceipt}.
 */
export type BlsBundleReceipt = {
  bundleHash: string;
};

/**
 * The bundle receipt returned from a BLS Wallet Aggregator instance. It is a combination of an ethers {@link ContractReceipt} and a {@link BlsBundleReceipt} type.
 */
export type BundleReceipt = ContractReceipt & BlsBundleReceipt;

/**
 * Client used to interact with a BLS Wallet Aggregator instance
 */
export default class Aggregator {
  // Fetch implementation to use
  private readonly fetchImpl;
  origin: string;

  /**
   * Constructs an Aggregator object
   *
   * @param url URL of the aggregator instance
   */
  constructor(url: string) {
    const parsedUrl = new URL(url);

    if (parsedUrl.pathname !== "/" || parsedUrl.search !== "") {
      throw new Error(`Invalid client url includes pathname/search: ${url}`);
    }

    this.origin = new URL(url).origin;
    // Prefer runtime's imeplmentation of fetch over node-fetch
    this.fetchImpl = "fetch" in globalThis ? fetch.bind(globalThis) : nodeFetch;
  }

  /**
   * Sends a bundle to the aggregator
   *
   * @param bundle Bundle to send
   * @returns The hash of the bundle or an array of failures if the aggregator did not accept the bundle
   */
  async add(
    bundle: Bundle,
  ): Promise<{ hash: string } | { failures: TransactionFailure[] }> {
    const json: any = await this.jsonPost("/bundle", bundleToDto(bundle));

    if (
      json === null ||
      typeof json !== "object" ||
      (!("failures" in json) && !("hash" in json))
    ) {
      throw new Error(`Unexpected response: ${JSON.stringify(json)}`);
    }

    return json;
  }

  /**
   * Estimates the fee required for a bundle by the aggreagtor to submit it.
   *
   * @param bundle Bundle to estimates the fee for
   * @returns Estimate of the fee needed to submit the bundle
   */
  async estimateFee(bundle: Bundle): Promise<EstimateFeeResponse> {
    const result = await this.jsonPost("/estimateFee", bundleToDto(bundle));

    return result as EstimateFeeResponse;
  }

  /**
   * Looks for a transaction receipt for a Bundle sent to the aggregator.
   * This will return undefined if the bundle has not yet been submitted by the aggregator.
   *
   * @param hash Hash of the bundle to find a transaction receipt for.
   * @returns The bundle receipt, a submission error if the aggregator was unable to submit the bundle on chain, or undefined if the receipt was not found.
   */
  async lookupReceipt(
    hash: string,
  ): Promise<BundleReceipt | BundleReceiptError | undefined> {
    return this.jsonGet<BundleReceipt | BundleReceiptError>(
      `${this.origin}/bundleReceipt/${hash}`,
    );
  }

  // Note: This should be private instead of exposed. Leaving as is for compatibility.
  async jsonPost(path: string, body: unknown): Promise<unknown> {
    const resp = await this.fetchImpl(`${this.origin}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
    });

    const text = await resp.text();

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Unexpected invalid JSON response: ${text}`);
    }

    return json;
  }

  private async jsonGet<T>(path: string): Promise<T | undefined> {
    const resp = await this.fetchImpl(path);
    const respText = await resp.text();
    if (!respText) {
      return undefined;
    }

    const json = JSON.parse(respText);
    const isValidNonEmptyJson = json && Object.keys(json).length;
    if (isValidNonEmptyJson) {
      return json as T;
    }

    return undefined;
  }
}
