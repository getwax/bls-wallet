import 'source-map-support/register';

import { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { expect } from "chai";

import { initBlsWalletSigner, Transaction, TransactionTemplate } from "../src";

const domain = arrayify(keccak256("0xfeedbee5"));
const weiPerToken = BigNumber.from(10).pow(18);

const samples = (() => {
  const dummy256HexString = "0x" + "0123456789".repeat(10).slice(0, 64);
  const contractAddress = dummy256HexString;

  const txTemplate: TransactionTemplate = {
    nonce: BigNumber.from(123),
    ethValue: BigNumber.from(0),
    contractAddress,
    encodedFunction: "0x00",
  };

  const privateKey = dummy256HexString;
  const otherPrivateKey = "0xaa" + privateKey.slice(4);

  return {
    contractAddress,
    txTemplate,
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

    const { txTemplate, privateKey, otherPrivateKey } = samples;

    const tx = sign(txTemplate, privateKey);

    expect(tx.signature).to.equal([
      "0x177500780b42f245e98229245126c9042e1cdaadc7ada72021ddd43492963a7b26f7a",
      "a8f971b133e9f61d4197b4fb40fc82f5c239183cba80d6338a64500cb27",
    ].join(""));

    expect(verify(tx)).to.equal(true);

    const txBadSig = {
      ...tx,
      signature: sign(txTemplate, otherPrivateKey).signature,
    };

    expect(verify(txBadSig)).to.equal(false);

    const txBadMessage: Transaction = {
      subTransactions: [
        {
          ...tx.subTransactions[0],
          // Pretend the client signed to pay a million tokens
          ethValue: weiPerToken.mul(1000000),
        },
      ],
      signature: tx.signature,
    };

    expect(verify(txBadMessage)).to.equal(false);
  });

  it("aggregates transactions", async () => {
    const {
      sign,
      aggregate,
      verify,
    } = await initBlsWalletSigner({ chainId: 123, domain });

    const { txTemplate, privateKey } = samples;

    const tx1 = sign(txTemplate, privateKey);
    const tx2 = aggregate([tx1, tx1]);

    expect(tx2.signature).to.equal([
      "0x2cc0b05e8200cf564042735d15e2cc98181e730203530300022aafdd1ceb905830430",
      "28617145dca56a00bf0693710e24683616ff4a42bc3cca7d587b36ff91f",
    ].join(""));

    expect(verify(tx2)).to.equal(true);

    const tx2BadMessage: Transaction = {
      ...tx2,
      subTransactions: [
        tx2.subTransactions[0],
        {
          ...tx2.subTransactions[1],

          // Pretend this client signed to pay a million tokens
          ethValue: weiPerToken.mul(1000000),
        },
      ],
    }

    expect(verify(tx2BadMessage)).to.equal(false);
  });
});
