import nil from "../../src/helpers/nil.ts";
import Calculator from "./Calculator.ts";

type Encoder = {
  encode(data: string): string | nil;
  decode(encodedData: string): string;
};

const calc = new Calculator();

// console.log(
//   calc.txDataByMethodId()["0xa9059cbb"].slice(0, 10).map(getDataWords),
// );

console.log(calc.totalLength());
