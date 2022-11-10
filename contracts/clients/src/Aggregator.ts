import { BigNumber, ContractReceipt } from "ethers";
import { Log } from "@ethersproject/abstract-provider";
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

export type BundleReceipt = {
  transactionIndex: string;
  transactionHash: string;
  bundleHash: string;
  blockHash: string;
  blockNumber: string;
};

// TODO: Messing around with returning the receipt type that ethers expects 
// export interface BundleReceipt extends ContractReceipt {
//   bundleHash: string;
//   to: string;
//   from: string;
//   contractAddress: string;
//   transactionIndex: number;
//   root?: string;
//   gasUsed: BigNumber;
//   logsBloom: string;
//   blockHash: string;
//   transactionHash: string;
//   logs: Array<Log>;
//   blockNumber: number;
//   confirmations: number;
//   cumulativeGasUsed: BigNumber;
//   effectiveGasPrice: BigNumber;
//   byzantium: boolean;
//   type: number;
//   status?: number;
// }

export default class Aggregator {
  origin: string;

  constructor(url: string) {
    const parsedUrl = new URL(url);

    if (parsedUrl.pathname !== "/" || parsedUrl.search !== "") {
      throw new Error(`Invalid client url includes pathname/search: ${url}`);
    }

    this.origin = new URL(url).origin;
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

  async lookupReceipt(hash: string): Promise<BundleReceipt | undefined> {
    const response = await fetch(`${this.origin}/bundleReceipt/${hash}`);

    if (response.status === 404) {
      return undefined;
    }

    return await response.json();
  }

  async jsonPost(path: string, body: unknown): Promise<unknown> {
    const resp = await fetch(`${this.origin}${path}`, {
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
}
