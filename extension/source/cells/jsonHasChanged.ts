export default function jsonHasChanged<T>(previous: T | undefined, latest: T) {
  return JSON.stringify(previous) !== JSON.stringify(latest);
}
