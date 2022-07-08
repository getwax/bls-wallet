export default function formatCompactAddress(address: string): string {
  return `0x${address.slice(2, 6)}...${address.slice(-4)}`;
}
