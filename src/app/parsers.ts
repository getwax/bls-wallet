import { BigNumber, TransactionData } from "../../deps.ts";

export type TransactionDataDTO = {
  [K in keyof TransactionData]: (
    TransactionData[K] extends BigNumber ? string : TransactionData[K]
  );
};

type ParseResult<T> = (
  | { success: T }
  | { failures: string[] }
);

type Parser<T> = (value: unknown) => ParseResult<T>;

type CombinedSuccess<Results> = (
  Results extends ParseResult<unknown>[]
    ? Results extends [ParseResult<infer T>, ...infer Tail]
      ? [T, ...CombinedSuccess<Tail>]
    : []
    : never
);

function combine<Results extends ParseResult<unknown>[]>(
  ...results: Results
): ParseResult<CombinedSuccess<Results>> {
  const successes: unknown[] = [];
  const failures: string[] = [];

  for (const result of results) {
    if ("success" in result) {
      successes.push(result.success);
    } else {
      failures.push(...result.failures);
    }
  }

  if (successes.length === results.length) {
    return { success: successes as CombinedSuccess<Results> };
  }

  return { failures };
}

export function field<T>(
  obj: unknown,
  name: string,
  parser: Parser<T>,
): ParseResult<T> {
  if (typeof obj !== "object" || obj === null || !(name in obj)) {
    return { failures: [`field ${name}: not provided`] };
  }

  const parseResult = parser((obj as Record<string, unknown>)[name]);

  if ("success" in parseResult) {
    return parseResult;
  }

  return {
    failures: parseResult.failures.map((f) => `field ${name}: ${f}`),
  };
}

function parseString(value: unknown): ParseResult<string> {
  if (typeof value === "string") {
    return { success: value };
  }

  return { failures: ["not a string"] };
}

export function parseHex(
  opts: Partial<{ bytes: number }> = {},
): Parser<string> {
  return (value) => {
    const parsedString = parseString(value);

    if ("failures" in parsedString) {
      return parsedString;
    }

    const str = parsedString.success;

    const prefix = "bytes" in opts
      ? `${opts.bytes}-byte hex string`
      : "hex string";

    const failures: string[] = [];

    if (str.slice(0, 2) !== "0x") {
      failures.push("missing 0x prefix");
    }

    if (!/[a-f]*/i.test(str.slice(2))) {
      failures.push("contains non-hex characters");
    }

    const byteLength = (str.length - 2) / 2;

    if (
      byteLength % 1 !== 0 ||
      ("bytes" in opts && byteLength !== opts.bytes)
    ) {
      failures.push(`incorrect byte length: ${byteLength}`);
    }

    if (failures.length > 0) {
      return { failures: failures.map((f) => `${prefix}: ${f}`) };
    }

    return { success: str };
  };
}

export function parseNumber(value: unknown): ParseResult<number> {
  if (typeof value === "number") {
    return { success: value };
  }

  return { failures: ["not a number"] };
}

export function parseTransactionDataDTO(
  txData: unknown,
): ParseResult<TransactionDataDTO> {
  const result = combine(
    field(txData, "publicKey", parseHex({ bytes: 128 })),
    field(txData, "signature", parseHex({ bytes: 64 })),
    field(txData, "nonce", parseHex()),
    field(txData, "tokenRewardAmount", parseHex()),
    field(txData, "contractAddress", parseHex({ bytes: 20 })),
    field(txData, "encodedFunctionData", parseHex()),
  );

  if ("failures" in result) {
    return result;
  }

  const [
    publicKey,
    signature,
    nonce,
    tokenRewardAmount,
    contractAddress,
    encodedFunctionData,
  ] = result.success;

  return {
    success: {
      publicKey,
      signature,
      nonce,
      tokenRewardAmount,
      contractAddress,
      encodedFunctionData,
    },
  };
}
