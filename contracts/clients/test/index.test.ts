import "source-map-support/register";

import { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { expect } from "chai";

import {
  initBlsWalletSigner,
  Transaction,
  TransactionTemplate,
} from "../src/signer";

import Range from "./helpers/Range";

const domain = arrayify(keccak256("0xfeedbee5"));
const weiPerToken = BigNumber.from(10).pow(18);

const samples = (() => {
  const dummy256HexString = "0x" + "0123456789".repeat(10).slice(0, 64);
  const contractAddress = dummy256HexString;

  const txTemplate: TransactionTemplate = {
    nonce: BigNumber.from(123),
    atomic: true,
    actions: [
      {
        ethValue: BigNumber.from(0),
        contractAddress,
        encodedFunction: "0x00",
      },
      {
        ethValue: BigNumber.from(1),
        contractAddress,
        encodedFunction: "0x00",
      },
    ],
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

    expect(tx.signature).to.equal(
      [
        "0x0058b38298f3c486223de7c61f461ff3b47530d2619a383e49b298a56249e4fb0bf8b",
        "eb03979073e57656af0a5bab043fe2d6bf4cbbf600f6a7190ce95fcf69c",
      ].join(""),
    );

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
          actions: [
            {
              ...tx.subTransactions[0].actions[0],
              // Pretend the client signed to pay a million tokens
              ethValue: weiPerToken.mul(1000000),
            },
            ...tx.subTransactions[0].actions.slice(1),
          ],
        },
      ],
      signature: tx.signature,
    };

    expect(verify(txBadMessage)).to.equal(false);
  });

  it("aggregates transactions", async () => {
    const { sign, aggregate, verify } = await initBlsWalletSigner({
      chainId: 123,
      domain,
    });

    const { txTemplate, privateKey } = samples;

    const tx1 = sign(txTemplate, privateKey);
    const tx2 = aggregate([tx1, tx1]);

    expect(tx2.signature).to.equal(
      [
        "0x091727df1b9834b31111c1d5c1e15989350de678232e46898c1c3c788e3c26ab1f69e",
        "3373d329564e875a1401c0b7a4a6f7ab3e9cf93ef73b59a1feb3286e693",
      ].join(""),
    );

    expect(verify(tx2)).to.equal(true);

    const tx2BadMessage: Transaction = {
      ...tx2,
      subTransactions: [
        tx2.subTransactions[0],
        {
          ...tx2.subTransactions[1],

          // Pretend this client signed to pay a million tokens
          actions: [
            {
              ...tx2.subTransactions[1].actions[0],
              ethValue: weiPerToken.mul(1000000),
            },
            ...tx2.subTransactions[1].actions.slice(1),
          ],
        },
      ],
    };

    expect(verify(tx2BadMessage)).to.equal(false);
  });

  it("can aggregate transactions which already have multiple subTransactions", async () => {
    const { sign, aggregate, verify } = await initBlsWalletSigner({
      chainId: 123,
      domain,
    });

    const { txTemplate, privateKey } = samples;

    const txs = Range(4).map((i) =>
      sign(
        {
          ...txTemplate,
          actions: [
            {
              ...txTemplate.actions[0],
              ethValue: BigNumber.from(i),
            },
          ],
        },
        privateKey,
      ),
    );

    const aggTx1 = aggregate(txs.slice(0, 2));
    const aggTx2 = aggregate(txs.slice(2, 4));

    const aggAggTx = aggregate([aggTx1, aggTx2]);

    expect(verify(aggAggTx)).to.equal(true);
  });
});
