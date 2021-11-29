import { Bundle, PublicKey, Signature } from './signer';

// TODO: Rename to BundleFailure?
type TransactionFailure =
  | { type: 'invalid-format'; description: string }
  | { type: 'invalid-signature'; description: string }
  | { type: 'duplicate-nonce'; description: string }
  | { type: 'insufficient-reward'; description: string }
  | { type: 'unpredictable-gas-limit'; description: string }
  | { type: 'invalid-creation'; description: string };

export type ActionDataDTO = {
  ethValue: string;
  contractAddress: string;
  encodedFunction: string;
};

export type OperationDTO = {
  nonce: string;
  atomic: boolean;
  actions: ActionDataDTO[];
};

export type BundleDTO = {
  users: PublicKey[],
  operations: OperationDTO[],
  signature: Signature;
};

export default class Aggregator {
  origin: string;

  constructor(url: string) {
    const parsedUrl = new URL(url);

    if (parsedUrl.pathname !== '/' || parsedUrl.search !== '') {
      throw new Error(`Invalid client url includes pathname/search: ${url}`);
    }

    this.origin = new URL(url).origin;
  }

  async add(bundle: Bundle): Promise<TransactionFailure[]> {
    const resp = await fetch(`${this.origin}/transaction`, {
      method: 'POST',
      body: JSON.stringify(toDto(bundle)),
      headers: {
        'content-type': 'application/json',
      },
    });

    const text = await resp.text();

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Unexpected invalid JSON response: ${text}`);
    }

    if (json === null || typeof json !== 'object' || !('failures' in json)) {
      throw new Error(`Unexpected response: ${text}`);
    }

    return json.failures;
  }
}

function toDto(bundle: Bundle): BundleDTO {
  return {
    users: bundle.users,
    operations: bundle.operations.map(op => ({
      nonce: op.nonce.toHexString(),
      atomic: op.atomic,
      actions: op.actions.map(a => ({
        ethValue: a.ethValue.toHexString(),
        contractAddress: a.contractAddress,
        encodedFunction: a.encodedFunction,
      })),
    })),
    signature: bundle.signature,
  };
}
