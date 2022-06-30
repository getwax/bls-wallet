import assert from './assert';

export default function pickRandom<T extends unknown[]>(
  values: T,
  rng = Math.random,
): T[number] {
  assert(values.length > 0);
  const pickedValue = values[Math.floor(values.length * rng())];
  return pickedValue;
}
