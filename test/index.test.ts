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
    tokenRewardAmount: BigNumber.from(0),
    ethValue: BigNumber.from(0),
    contractAddress,
    encodedFunctionData: "0x00",
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
      "0x1cafe561a44d1c05fce30f2751d498977f69a179d1ab2e0adb1ec64726c8d2bd2e3e7",
      "e05f784a3d962c6b4ff508f177518bc7d63f86accfabe10272de552a3e2",
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
      "0x272bb5add2990283a24f35f10affa52282be6b175501d1fd2af10439fbecfa3a2d982",
      "e5069ef118bd0a5ef60fdbb98e90322577dbc8be6b5dd1eef148ff0b03d",
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
