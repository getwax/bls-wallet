import { TransactionData } from "./TxTable.ts";

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

function field<T>(
  obj: unknown,
  name: string,
  parser: Parser<T>,
): ParseResult<T> {
  if (obj === null || typeof obj !== "object") {
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

function parseNumber(value: unknown): ParseResult<number> {
  if (typeof value === "number") {
    return { success: value };
  }

  return { failures: ["not a number"] };
}

export function parseTransactionData(
  txData: unknown,
): ParseResult<TransactionData> {
  console.log("parsing", txData);

  const result = combine(
    field(txData, "pubKey", parseString),
    field(txData, "nonce", parseNumber),
    field(txData, "signature", parseString),
    field(txData, "tokenRewardAmount", parseString),
    field(txData, "contractAddress", parseString),
    field(txData, "methodId", parseString),
    field(txData, "encodedParams", parseString),
  );

  if ("failures" in result) {
    return result;
  }

  const [
    pubKey,
    nonce,
    signature,
    tokenRewardAmount,
    contractAddress,
    methodId,
    encodedParams,
  ] = result.success;

  return {
    success: {
      pubKey,
      nonce,
      signature,
      tokenRewardAmount,
      contractAddress,
      methodId,
      encodedParams,
    },
  };
}
