import { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { expect } from "chai";

import init, { RawTransactionData } from "../src";

const domain = arrayify(keccak256("0xfeedbee5"));

const samples = (() => {
  const dummy256HexString = "0x" + "0123456789".repeat(10).slice(0, 64);
  const contractAddress = dummy256HexString;

  const rawTx: RawTransactionData = {
    contractAddress,
    encodedFunctionData: "0x00",
    nonce: BigNumber.from(123),
    tokenRewardAmount: BigNumber.from(0),
  };

  const privateKey = dummy256HexString;

  return {
    contractAddress,
    rawTx,
    privateKey,
  };
})();

describe("index", () => {
  it("signs a transaction", async () => {
    debugger;
    const { sign } = await init({ chainId: 123, domain });

    const { rawTx, privateKey } = samples;

    const tx = sign(rawTx, privateKey);

    expect(tx.signature).to.equal([
      "0x3029b820b2556ad22b102b7973e9b96c0d7615a0ae6ec3dea6bd2a5cf8bf8bc92ede8",
      "84303e8f7541c655501f6c05d8d0d8c3063f372fe86e82ef04a2844199e",
    ].join(""));
  });
});
