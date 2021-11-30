import { BundleDto } from "../../deps.ts";

type ParseResult<T> = (
  | { success: T }
  | { failures: string[] }
);

type Parser<T> = (value: unknown) => ParseResult<T>;

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

type DataObject<ParserObject extends Record<string, Parser<unknown>>> = {
  [K in keyof ParserObject]:
    (ParserObject[K] extends Parser<infer T> ? T : never);
};

function parseObject<ParserObject extends Record<string, Parser<unknown>>>(
  parserObject: ParserObject,
): Parser<DataObject<ParserObject>> {
  return (value) => {
    if (typeof value !== "object" || value === null) {
      return { failures: ["not an object"] };
    }

    const valueRecord = value as Record<string, unknown>;

    const result: Record<string, unknown> = {};
    const failures: string[] = [];

    for (const key of Object.keys(parserObject)) {
      if (!(key in valueRecord)) {
        failures.push(`field ${key}: not provided`);
        continue;
      }

      const element = valueRecord[key];
      const parseResult = parserObject[key](element);

      if ("failures" in parseResult) {
        failures.push(...parseResult.failures.map((f) => `field ${key}: ${f}`));
      } else {
        result[key] = parseResult.success;
      }
    }

    return { success: result as DataObject<ParserObject> };
  };
}

type OperationDto = BundleDto["operations"][number];
type ActionDataDto = OperationDto["actions"][number];

const parseActionDataDto: Parser<ActionDataDto> = parseObject({
  ethValue: parseHex(),
  contractAddress: parseHex(),
  encodedFunction: parseHex(),
});

const parseOperationDto: Parser<OperationDto> = parseObject({
  nonce: parseHex(),
  actions: parseArray(parseActionDataDto),
});

export const parseBundleDto: Parser<BundleDto> = parseObject({
  senderPublicKeys: parseArray(
    parseTuple(parseHex(), parseHex(), parseHex(), parseHex()),
  ),
  operations: parseArray(parseOperationDto),
  signature: parseTuple(parseHex(), parseHex()),
});
