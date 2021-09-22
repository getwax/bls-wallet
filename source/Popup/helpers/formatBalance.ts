import { BigNumber } from 'ethers';

export default function formatBalance(
  balance: string | undefined,
  currency: string,
): string {
  if (balance === undefined) {
    return '';
  }

  const microBalance = BigNumber.from(balance).div(BigNumber.from(10).pow(12));

  return `${(microBalance.toNumber() / 1000000).toFixed(3)} ${currency}`;
}
