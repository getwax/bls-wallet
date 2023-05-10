import Calculator from "./Calculator.ts";
import MultiEncoder from "./MultiEncoder.ts";

const multiEncoder = new MultiEncoder();

const calc = new Calculator(multiEncoder);

calc.checkDecodedTransactionData();

console.log(calc.compressionRatio().toFixed(4));
