export default function tuple<T extends unknown[]>(...values: T) {
  return values;
}
