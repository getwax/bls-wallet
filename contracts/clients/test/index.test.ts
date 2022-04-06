import "source-map-support/register";

import { BigNumber } from "ethers";
import { keccak256, arrayify } from "ethers/lib/utils";
import { expect } from "chai";

import { initBlsWalletSigner, Bundle, Operation } from "../src/signer";

import Range from "./helpers/Range";

const domain = arrayify(keccak256("0xfeedbee5"));
const weiPerToken = BigNumber.from(10).pow(18);

const samples = (() => {
  const dummy256HexString = "0x" + "0123456789".repeat(10).slice(0, 64);
  const contractAddress = dummy256HexString;

  const bundleTemplate: Operation = {
    nonce: BigNumber.from(123),
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
    bundleTemplate,
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

    const { bundleTemplate, privateKey, otherPrivateKey } = samples;

    const bundle = sign(bundleTemplate, privateKey);

    expect(bundle.signature).to.deep.equal([
      "0x0f8af80a400b731f4f2ddcd29816f296cca75e34816d466512a703631de3bb69",
      "0x023d76b485531a8dbc087b2d6f25563ad7f6d81d25f5f123186d0ec26da5e2d0",
    ]);

    expect(verify(bundle)).to.equal(true);

    const bundleBadSig = {
      ...bundle,
      signature: sign(bundleTemplate, otherPrivateKey).signature,
    };

    expect(verify(bundleBadSig)).to.equal(false);

    const bundleBadMessage: Bundle = {
      senderPublicKeys: bundle.senderPublicKeys,
      operations: [
        {
          ...bundle.operations[0],
          actions: [
            {
              ...bundle.operations[0].actions[0],
              // Pretend the client signed to pay a million tokens
              ethValue: weiPerToken.mul(1000000),
            },
            ...bundle.operations[0].actions.slice(1),
          ],
        },
      ],
      signature: bundle.signature,
    };

    expect(verify(bundleBadMessage)).to.equal(false);
  });

  it("aggregates transactions", async () => {
    const { sign, aggregate, verify } = await initBlsWalletSigner({
      chainId: 123,
      domain,
    });

    const { bundleTemplate, privateKey } = samples;

    const bundle1 = sign(bundleTemplate, privateKey);
    const bundle2 = aggregate([bundle1, bundle1]);

    expect(bundle2.signature).to.deep.equal([
      "0x0008678ea56953fdca1b007b2685d3ed164b11de015f0a87ee844860c8e6cf30",
      "0x2bc51003125b2da84a01e639c3c2be270a9b93ed82498bffbead65c6f07df708",
    ]);

    expect(verify(bundle2)).to.equal(true);

    const bundle2BadMessage: Bundle = {
      ...bundle2,
      operations: [
        bundle2.operations[0],
        {
          ...bundle2.operations[1],

          // Pretend this client signed to pay a million tokens
          actions: [
            {
              ...bundle2.operations[1].actions[0],
              ethValue: weiPerToken.mul(1000000),
            },
            ...bundle2.operations[1].actions.slice(1),
          ],
        },
      ],
    };

    expect(verify(bundle2BadMessage)).to.equal(false);
  });

  it("can aggregate transactions which already have multiple subTransactions", async () => {
    const { sign, aggregate, verify } = await initBlsWalletSigner({
      chainId: 123,
      domain,
    });

    const { bundleTemplate, privateKey } = samples;

    const bundles = Range(4).map((i) =>
      sign(
        {
          ...bundleTemplate,
          actions: [
            {
              ...bundleTemplate.actions[0],
              ethValue: BigNumber.from(i),
            },
          ],
        },
        privateKey,
      ),
    );

    const aggBundle1 = aggregate(bundles.slice(0, 2));
    const aggBundle2 = aggregate(bundles.slice(2, 4));

    const aggAggBundle = aggregate([aggBundle1, aggBundle2]);

    expect(verify(aggAggBundle)).to.equal(true);
  });

  it("generates expected publicKeyStr", async () => {
    const { getPublicKeyStr } = await initBlsWalletSigner({
      chainId: 123,
      domain,
    });

    expect(getPublicKeyStr(samples.privateKey)).to.equal(
      [
        "0x",
        "027c3c0483be2722a29a0229bef64b2d8c1f8d4e954b0203d01ce342608b6eb8",
        "060c1136ac3aef9ba4b2a0272920fba5528f6e97b376c511bc746e47414a0d04",
        "11a697990758be620b0f09d3ad5bebe359964b74a29b89bdeb60671d243997fa",
        "2075298b12a51948b7a40dc69bdc91698ed95e5d2a69d04845af64aaf2eb1537",
      ].join(""),
    );
  });

  it("aggregates an empty bundle", async () => {
    const { aggregate } = await initBlsWalletSigner({
      chainId: 123,
      domain,
    });

    const emptyBundle = aggregate([]);
    const emptyBundle2 = aggregate([emptyBundle]);

    expect(emptyBundle2.operations.length).to.equal(0);
  });

  it("verifies an empty bundle", async () => {
    const { aggregate, verify } = await initBlsWalletSigner({
      chainId: 123,
      domain,
    });

    const emptyBundle = aggregate([]);

    expect(verify(emptyBundle)).to.equal(true);
  });
});
