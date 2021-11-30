import { BundleDto } from "../../deps.ts";

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

export function parseArray<T>(
  elementParser: Parser<T>,
): Parser<T[]> {
  return (value) => {
    if (!Array.isArray(value)) {
      return { failures: ["not an array"] };
    }

    const parsedElements: T[] = [];
    const failures: string[] = [];

    for (let i = 0; i < value.length; i++) {
      const element = value[i];
      const parseResult = elementParser(element);

      if ("failures" in parseResult) {
        failures.push(...parseResult.failures.map((f) => `element ${i}: ${f}`));
      } else {
        parsedElements.push(parseResult.success);
      }
    }

    if (failures.length > 0) {
      return { failures };
    }

    return { success: parsedElements };
  };
}

type DataTuple<ParserTuple> = (
  ParserTuple extends Parser<unknown>[] ? (
    ParserTuple extends [Parser<infer T>, ...infer Tail]
      ? [T, ...DataTuple<Tail>]
      : []
  )
    : never
);

export function parseTuple<ParserTuple extends Parser<unknown>[]>(
  ...parserTuple: ParserTuple
): Parser<DataTuple<ParserTuple>> {
  return (value) => {
    if (!Array.isArray(value)) {
      return { failures: ["not an array"] };
    }

    const parsedElements: unknown[] = [];
    const failures: string[] = [];

    for (let i = 0; i < value.length; i++) {
      const element = value[i];
      const parseResult = parserTuple[i](element);

      if ("failures" in parseResult) {
        failures.push(...parseResult.failures.map((f) => `element ${i}: ${f}`));
      } else {
        parsedElements.push(parseResult.success);
      }
    }

    if (failures.length > 0) {
      return { failures };
    }

    return { success: parsedElements as DataTuple<ParserTuple> };
  };
}

type OperationDto = BundleDto["operations"][number];
type ActionDataDto = OperationDto["actions"][number];

function parseActionDataDto(actionData: unknown): ParseResult<ActionDataDto> {
  const result = combine(
    field(actionData, "ethValue", parseHex()),
    field(actionData, "contractAddress", parseHex()),
    field(actionData, "encodedFunction", parseHex()),
  );

  if ("failures" in result) {
    return result;
  }

  const [
    ethValue,
    contractAddress,
    encodedFunction,
  ] = result.success;

  return {
    success: {
      ethValue,
      contractAddress,
      encodedFunction,
    },
  };
}

function parseOperationDto(operationData: unknown): ParseResult<OperationDto> {
  const result = combine(
    field(operationData, "nonce", parseHex()),
    field(operationData, "actions", parseArray(parseActionDataDto)),
  );

  if ("failures" in result) {
    return result;
  }

  const [
    nonce,
    actions,
  ] = result.success;

  return {
    success: {
      nonce,
      actions,
    },
  };
}

export function parseBundleDto(bundleData: unknown): ParseResult<BundleDto> {
  const result = combine(
    field(
      bundleData,
      "senderPublicKeys",
      parseArray(parseTuple(parseHex(), parseHex(), parseHex(), parseHex())),
    ),
    field(bundleData, "operations", parseArray(parseOperationDto)),
    field(bundleData, "signature", parseTuple(parseHex(), parseHex())),
  );

  if ("failures" in result) {
    return result;
  }

  const [senderPublicKeys, operations, signature] = result.success;

  return {
    success: {
      senderPublicKeys,
      operations,
      signature,
    },
  };
}
