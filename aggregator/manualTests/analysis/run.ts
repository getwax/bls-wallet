import Calculator from "./Calculator.ts";
import MultiEncoder from "./MultiEncoder.ts";
import ERC20TransferEncoder from "./encoders/ERC20TransferEncoder.ts";
import FallbackEncoder from "./encoders/FallbackEncoder.ts";

const multiEncoder = new MultiEncoder();

multiEncoder.register(2, new ERC20TransferEncoder());
multiEncoder.register(1, new FallbackEncoder());

const calc = new Calculator(multiEncoder);

calc.checkDecodedTransactionData();

console.log(calc.compressionRatio().toFixed(4));
