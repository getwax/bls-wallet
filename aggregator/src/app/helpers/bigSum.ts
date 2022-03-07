import { BigNumber } from "../../../deps.ts";

export default function bigSum(values: BigNumber[]) {
  return values.reduce((a, b) => a.add(b), BigNumber.from(0));
}
