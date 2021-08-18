import { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { expect } from "chai";

import { initBlsWalletSigner, RawTransactionData } from "../src";

const domain = arrayify(keccak256("0xfeedbee5"));
const weiPerToken = BigNumber.from(10).pow(18);

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
  const otherPrivateKey = "0xaa" + privateKey.slice(4);

  return {
    contractAddress,
    rawTx,
    privateKey,
    otherPrivateKey,
  };
})();

describe("index", () => {
  it("signs and verifies transaction", async () => {
    const { sign, verify } = await initBlsWalletSigner({
      chainId: 123,
      domain,
    });

    const { rawTx, privateKey, otherPrivateKey } = samples;

    const tx = sign(rawTx, privateKey);

    expect(tx.signature).to.equal([
      "0x3029b820b2556ad22b102b7973e9b96c0d7615a0ae6ec3dea6bd2a5cf8bf8bc92ede8",
      "84303e8f7541c655501f6c05d8d0d8c3063f372fe86e82ef04a2844199e",
    ].join(""));

    expect(verify(tx)).to.equal(true);

    const txBadSig = {
      ...sign(rawTx, otherPrivateKey),
      publicKey: tx.publicKey, // Pretend this is the public key
    };
    
    expect(verify(txBadSig)).to.equal(false);

    const txBadMessage = {
      ...tx,

      // Pretend the client signed that they pay the aggregator a million tokens
      tokenRewardAmount: weiPerToken.mul(1000000),
    }

    expect(verify(txBadMessage)).to.equal(false);
  });

  it("aggregates transactions", async () => {
    const {
      sign,
      aggregate,
      verifyAggregate,
    } = await initBlsWalletSigner({ chainId: 123, domain });

    const { rawTx, privateKey } = samples;

    const tx = sign(rawTx, privateKey);
    const aggregateTx = aggregate([tx, tx]);

    expect(aggregateTx.signature).to.equal([
      "0x06a5a217ddc5e7404288c61009f115185be0ca9bce42492ed704d2134983df1e24ca1",
      "3d4a19996f4ecbdc6b355c277975b2fb43348b0589e36babf3298fb7369",
    ].join(""));

    expect(verifyAggregate(aggregateTx)).to.equal(true);

    const aggregateTxBadMessage = {
      ...aggregateTx,
      transactions: [
        aggregateTx.transactions[0],
        {
          ...aggregateTx.transactions[1],

          // Pretend this client signed that they pay the aggregator a million
          // tokens
          tokenRewardAmount: weiPerToken.mul(1000000),
        }
      ],
    }

    expect(verifyAggregate(aggregateTxBadMessage)).to.equal(false);
  });
});
