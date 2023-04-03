export default function hexLen(str: string) {
  if (!str.startsWith("0x")) {
    throw new Error("Not a hex string");
  }

  return (str.length - 2) / 2;
}
