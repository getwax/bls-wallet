export default function Range(limit: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < limit; i += 1) {
    result.push(i);
  }

  return result;
}
