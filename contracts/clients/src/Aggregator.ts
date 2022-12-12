import fetch from "node-fetch";
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

export type BundleReceipt = {
  transactionIndex: number;
  transactionHash: string;
  bundleHash: string;
  blockHash: string;
  blockNumber: number;
};

export default class Aggregator {
  private readonly fetchImpl;
  origin: string;

  constructor(url: string) {
    const parsedUrl = new URL(url);

    if (parsedUrl.pathname !== "/" || parsedUrl.search !== "") {
      throw new Error(`Invalid client url includes pathname/search: ${url}`);
    }

    this.origin = new URL(url).origin;
    this.fetchImpl = globalThis.fetch ?? fetch;
  }

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

  async estimateFee(bundle: Bundle): Promise<EstimateFeeResponse> {
    const result = await this.jsonPost("/estimateFee", bundleToDto(bundle));

    return result as EstimateFeeResponse;
  }

  async lookupReceipt(
    hash: string,
  ): Promise<BundleReceipt | BundleReceiptError | undefined> {
    return this.jsonGet<BundleReceipt | BundleReceiptError>(
      `${this.origin}/bundleReceipt/${hash}`,
    );
  }

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
    const json = await resp.json();

    const isValidNonEmptyJson = json && Object.keys(json).length;
    if (isValidNonEmptyJson) {
      return json as T;
    }

    return undefined;
  }
}
