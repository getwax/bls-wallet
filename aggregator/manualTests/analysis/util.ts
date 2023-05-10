export function sum(a: number, b: number) {
  return a + b;
}

export function getDataWords(data: string) {
  const res = [];

  for (let i = 2; i < data.length; i += 64) {
    res.push(data.slice(i, i + 64));
  }

  return res;
}
