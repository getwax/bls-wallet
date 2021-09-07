import { TransactionData } from "../../deps.ts";
import TransactionFailure from "./TransactionFailure.ts";
import { TransactionDataDTO } from "./parsers.ts";

export default class Client {
  origin: string;

  constructor(url: string) {
    const parsedUrl = new URL(url);

    if (parsedUrl.pathname !== "/" || parsedUrl.search !== "") {
      throw new Error(`Invalid client url includes pathname/search: ${url}`);
    }

    this.origin = new URL(url).origin;
  }

  async addTransaction(tx: TransactionData): Promise<TransactionFailure[]> {
    const txDto: TransactionDataDTO = {
      ...tx,
      nonce: tx.nonce.toHexString(),
      tokenRewardAmount: tx.tokenRewardAmount.toHexString(),
    };

    const resp = await fetch(`${this.origin}/transaction`, {
      method: "POST",
      body: JSON.stringify(txDto),
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
