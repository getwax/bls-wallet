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
    nonce: BigNumber.from(123),
    rewardTokenAddress: "0x00",
    rewardTokenAmount: BigNumber.from(0),
    ethValue: BigNumber.from(0),
    contractAddress,
    encodedFunction: "0x00",
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
      "0x1fa9f87b5a23bf50508381109729aa9738dd68b44fd34143e5fc49fd35f812841470d",
      "edaf87aa073099d3fcff212f02bb2295f62756624daa996173270fa0b15",
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
      rewardTokenAmount: weiPerToken.mul(1000000),
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
      "0x011e6a5d683219dd2644e6a4edb5da2bf5c40ac061c77295a093bfc24a7192501c5c4",
      "3331cdd91996a4b5b039ea57430191bb870419a58d1e88125ebafc6ddd8",
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
          rewardTokenAmount: weiPerToken.mul(1000000),
        }
      ],
    }

    expect(verifyAggregate(aggregateTxBadMessage)).to.equal(false);
  });
});
