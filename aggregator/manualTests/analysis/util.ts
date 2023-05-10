export function sum(a: number, b: number) {
  return a + b;
}

export function getDataWords(data: string) {
  const res = [];

  for (let i = 2; i < data.length; i += 64) {
    res.push("0x" + data.slice(i, i + 64));
  }

  return res;
}

export function hexJoin(hexStrings: string[]) {
  return "0x" + hexStrings.map(remove0x).join("");
}

export function remove0x(hexString: string) {
  if (!hexString.startsWith("0x")) {
    throw new Error("Expected 0x prefix");
  }

  return hexString.slice(2);
}
