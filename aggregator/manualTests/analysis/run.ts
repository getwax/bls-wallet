import Calculator from "./Calculator.ts";
import MultiEncoder from "./MultiEncoder.ts";
import FallbackEncoder from "./encoders/FallbackEncoder.ts";

const multiEncoder = new MultiEncoder();
multiEncoder.register(1, new FallbackEncoder());

const calc = new Calculator(multiEncoder);

calc.checkDecodedTransactionData();

console.log(calc.compressionRatio().toFixed(4));
