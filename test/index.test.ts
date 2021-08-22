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
      "0x177500780b42f245e98229245126c9042e1cdaadc7ada72021ddd43492963a7b26f7a",
      "a8f971b133e9f61d4197b4fb40fc82f5c239183cba80d6338a64500cb27",
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
      "0x2cc0b05e8200cf564042735d15e2cc98181e730203530300022aafdd1ceb905830430",
      "28617145dca56a00bf0693710e24683616ff4a42bc3cca7d587b36ff91f",
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
