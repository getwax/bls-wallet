import { BigNumber } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import { Bundle } from "./signer";

// TODO: Rename to BundleFailure?
type TransactionFailure =
  | { type: "invalid-format"; description: string }
  | { type: "invalid-signature"; description: string }
  | { type: "duplicate-nonce"; description: string }
  | { type: "insufficient-reward"; description: string }
  | { type: "unpredictable-gas-limit"; description: string }
  | { type: "invalid-creation"; description: string };

export type ActionDataDTO = {
  ethValue: string;
  contractAddress: string;
  encodedFunction: string;
};

export type OperationDTO = {
  nonce: string;
  actions: ActionDataDTO[];
};

export type BundleDTO = {
  senderPublicKeys: [string, string, string, string][];
  operations: OperationDTO[];
  signature: [string, string];
};

export default class Aggregator {
  origin: string;

  constructor(url: string) {
    const parsedUrl = new URL(url);

    if (parsedUrl.pathname !== "/" || parsedUrl.search !== "") {
      throw new Error(`Invalid client url includes pathname/search: ${url}`);
    }

    this.origin = new URL(url).origin;
  }

  async add(bundle: Bundle): Promise<TransactionFailure[]> {
    const resp = await fetch(`${this.origin}/transaction`, {
      method: "POST",
      body: JSON.stringify(toDto(bundle)),
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

    if (json === null || typeof json !== "object" || !("failures" in json)) {
      throw new Error(`Unexpected response: ${text}`);
    }

    return json.failures;
  }
}

function toDto(bundle: Bundle): BundleDTO {
  return {
    senderPublicKeys: bundle.senderPublicKeys.map(([n0, n1, n2, n3]) => [
      BigNumber.from(n0).toHexString(),
      BigNumber.from(n1).toHexString(),
      BigNumber.from(n2).toHexString(),
      BigNumber.from(n3).toHexString(),
    ]),
    operations: bundle.operations.map((op) => ({
      nonce: BigNumber.from(op.nonce).toHexString(),
      actions: op.actions.map((a) => ({
        ethValue: BigNumber.from(a.ethValue).toHexString(),
        contractAddress: a.contractAddress,
        encodedFunction:
          typeof a.encodedFunction === "string"
            ? a.encodedFunction
            : solidityPack(["bytes"], [a.encodedFunction]),
      })),
    })),
    signature: [
      BigNumber.from(bundle.signature[0]).toHexString(),
      BigNumber.from(bundle.signature[1]).toHexString(),
    ],
  };
}
