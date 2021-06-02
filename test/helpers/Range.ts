export default function Range(limit: number) {
  const result: number[] = [];

  for (let i = 0; i < limit; i++) {
    result.push(i);
  }

  return result;
}
