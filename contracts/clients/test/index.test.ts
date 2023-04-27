import { BigNumber } from "ethers";
import { expect } from "chai";

import { initBlsWalletSigner, Bundle, Operation } from "../src/signer";

import Range from "./helpers/Range";

const weiPerToken = BigNumber.from(10).pow(18);

const samples = (() => {
  const dummy256HexString = "0x" + "0123456789".repeat(10).slice(0, 64);
  const contractAddress = dummy256HexString;
  // Random addresses
  const walletAddress = "0x1337AF0f4b693fd1c36d7059a0798Ff05a60DFFE";
  const otherWalletAddress = "0x42C8157D539825daFD6586B119db53761a2a91CD";
  const verificationGatewayAddress =
    "0xC8CD2BE653759aed7B0996315821AAe71e1FEAdF";

  const bundleTemplate: Operation = {
    nonce: BigNumber.from(123),
    gas: 30_000_000,
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
    walletAddress,
    otherWalletAddress,
    verificationGatewayAddress,
  };
})();

describe("index", () => {
  it("signs and verifies transaction", async () => {
    const { bundleTemplate, privateKey, otherPrivateKey, walletAddress } =
      samples;

    const { sign, verify } = await initBlsWalletSigner({
      chainId: 123,
      verificationGatewayAddress: samples.verificationGatewayAddress,
      privateKey,
    });

    const bundle = sign(bundleTemplate, walletAddress);

    expect(bundle.signature).to.deep.equal([
      "0x117171c1a4af03133390b454989658d9c6ae7a7fe1c3958ad545e584e63ab5e3",
      "0x2f90b24bbc03de665816b3a632e0c7b5fb837c87541d9337480671613cf1359c",
    ]);

    expect(verify(bundle, walletAddress)).to.equal(true);

    const { sign: signWithOtherPrivateKey } = await initBlsWalletSigner({
      chainId: 123,
      verificationGatewayAddress: samples.verificationGatewayAddress,
      privateKey: otherPrivateKey,
    });

    const bundleBadSig = {
      ...bundle,
      signature: signWithOtherPrivateKey(bundleTemplate, walletAddress)
        .signature,
    };

    expect(verify(bundleBadSig, walletAddress)).to.equal(false);

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

    expect(verify(bundleBadMessage, walletAddress)).to.equal(false);
  });

  it("aggregates transactions", async () => {
    const {
      bundleTemplate,
      privateKey,
      otherPrivateKey,
      walletAddress,
      otherWalletAddress,
    } = samples;

    const { sign, aggregate, verify } = await initBlsWalletSigner({
      chainId: 123,
      verificationGatewayAddress: samples.verificationGatewayAddress,
      privateKey,
    });
    const { sign: signWithOtherPrivateKey } = await initBlsWalletSigner({
      chainId: 123,
      verificationGatewayAddress: samples.verificationGatewayAddress,
      privateKey: otherPrivateKey,
    });

    const bundle1 = sign(bundleTemplate, walletAddress);
    const bundle2 = signWithOtherPrivateKey(bundleTemplate, otherWalletAddress);
    const aggBundle = aggregate([bundle1, bundle2]);

    expect(aggBundle.signature).to.deep.equal([
      "0x18b917c1f52155d9748025bd94aa07c0017af31dd2ef2a00289931f660e88ec9",
      "0x0235a99bcd1f0793efb7f3307cd349f211a433f60cfab795f5f976298f17a768",
    ]);

    expect(verify(bundle1, walletAddress)).to.equal(true);
    expect(verify(bundle2, otherWalletAddress)).to.equal(true);

    expect(verify(bundle1, otherWalletAddress)).to.equal(false);
    expect(verify(bundle2, walletAddress)).to.equal(false);

    const aggBundleBadMessage: Bundle = {
      ...aggBundle,
      operations: [
        aggBundle.operations[0],
        {
          ...aggBundle.operations[1],

          // Pretend this client signed to pay a million tokens
          actions: [
            {
              ...aggBundle.operations[1].actions[0],
              ethValue: weiPerToken.mul(1000000),
            },
            ...aggBundle.operations[1].actions.slice(1),
          ],
        },
      ],
    };

    expect(verify(aggBundleBadMessage, walletAddress)).to.equal(false);
    expect(verify(aggBundleBadMessage, otherWalletAddress)).to.equal(false);
  });

  it("can aggregate transactions which already have multiple subTransactions", async () => {
    const { bundleTemplate, privateKey, walletAddress } = samples;

    const { sign, aggregate, verify } = await initBlsWalletSigner({
      chainId: 123,
      verificationGatewayAddress: samples.verificationGatewayAddress,
      privateKey,
    });

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
        walletAddress,
      ),
    );

    const aggBundle1 = aggregate(bundles.slice(0, 2));
    const aggBundle2 = aggregate(bundles.slice(2, 4));

    const aggAggBundle = aggregate([aggBundle1, aggBundle2]);

    expect(verify(aggAggBundle, walletAddress)).to.equal(true);
  });

  it("generates expected publicKeyStr", async () => {
    const { privateKey } = samples;

    const { getPublicKeyStr } = await initBlsWalletSigner({
      chainId: 123,
      verificationGatewayAddress: samples.verificationGatewayAddress,
      privateKey,
    });

    expect(getPublicKeyStr()).to.equal(
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
    const { privateKey } = samples;

    const { aggregate } = await initBlsWalletSigner({
      chainId: 123,
      verificationGatewayAddress: samples.verificationGatewayAddress,
      privateKey,
    });

    const emptyBundle = aggregate([]);
    const emptyBundle2 = aggregate([emptyBundle]);

    expect(emptyBundle2.operations.length).to.equal(0);
  });

  it("verifies an empty bundle", async () => {
    const { privateKey } = samples;

    const { aggregate, verify } = await initBlsWalletSigner({
      chainId: 123,
      verificationGatewayAddress: samples.verificationGatewayAddress,
      privateKey,
    });

    const emptyBundle = aggregate([]);

    expect(verify(emptyBundle, samples.walletAddress)).to.equal(true);
  });
});
