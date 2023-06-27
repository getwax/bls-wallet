import { expect } from "chai";
import { BigNumber, ContractReceipt } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { expectPubkeysEql } from "./expect";
import { ActionData, getOperationResults } from "../clients/src";
import Fixture from "../shared/helpers/Fixture";
import { proxyAdminCall } from "../shared/helpers/callProxyAdmin";
import getPublicKeyFromHash from "../shared/helpers/getPublicKeyFromHash";

const expectOperationsToSucceed = (txnReceipt: ContractReceipt) => {
  const opResults = getOperationResults(txnReceipt);
  for (const opRes of opResults) {
    expect(opRes.success).to.eql(true);
    expect(opRes.error).to.eql(undefined);
  }
};

const expectOperationFailure = (
  txnReceipt: ContractReceipt,
  errorMessage: string,
) => {
  const opResults = getOperationResults(txnReceipt);
  expect(opResults).to.have.lengthOf(1);
  expect(opResults[0].success).to.equal(false);
  expect(opResults[0].error.actionIndex.toNumber()).to.eql(0);
  expect(opResults[0].error.message).to.eql(errorMessage);
};

describe("Upgrade", async function () {
  const safetyDelaySeconds = 7 * 24 * 60 * 60;
  const signatureExpiryOffsetSeconds = 1200;
  let fx: Fixture;
  beforeEach(async () => {
    fx = await Fixture.getSingleton();
  });

  it("should NOT upgrade wallet contract", async () => {
    const MockWalletUpgraded = await ethers.getContractFactory(
      "MockWalletUpgraded",
    );
    const mockWalletUpgraded = await MockWalletUpgraded.deploy();

    const wallet = await fx.createBLSWallet();

    // prepare call
    const txnReceipt1 = await proxyAdminCall(fx, wallet, "upgrade", [
      wallet.address,
      mockWalletUpgraded.address,
    ]);
    expectOperationFailure(txnReceipt1, "VG: wallet not upgradable");

    // make call
    const txnReceipt2 = await proxyAdminCall(fx, wallet, "upgradeAndCall", [
      wallet.address,
      mockWalletUpgraded.address,
      [],
    ]);
    expectOperationFailure(txnReceipt2, "VG: wallet not upgradable");
  });

  it("should register with new verification gateway", async () => {
    // Still possible to point wallets to a new gateway if desired, just not with v1 deployment
  });

  it("should change mapping of an address to hash", async () => {
    const vg1 = fx.verificationGateway;

    const [wallet1, wallet2] = await fx.createBLSWallets(2);

    // create wallet 1 & 2 to check they are mapped on vg correctly
    const createBundle = wallet1.blsWalletSigner.aggregate([
      wallet1.sign({
        nonce: await wallet1.Nonce(),
        gas: BigNumber.from(30_000_000),
        actions: [],
      }),
      wallet2.sign({
        nonce: await wallet2.Nonce(),
        gas: BigNumber.from(30_000_000),
        actions: [],
      }),
    ]);
    const createTxn = await fx.verificationGateway.processBundle(createBundle);
    await createTxn.wait();

    const hash1 = wallet1.blsWalletSigner.getPublicKeyHash();

    await expect(vg1.walletFromHash(hash1)).to.eventually.equal(
      wallet1.address,
    );
    await expect(vg1.hashFromWallet(wallet1.address)).to.eventually.equal(
      hash1,
    );
    expectPubkeysEql(
      await getPublicKeyFromHash(vg1, hash1),
      wallet1.PublicKey(),
    );

    // wallet 2 bls key signs message containing address of wallet 1
    const signatureExpiryTimestamp =
      (await fx.provider.getBlock("latest")).timestamp +
      safetyDelaySeconds +
      signatureExpiryOffsetSeconds;
    const addressMessage = solidityPack(
      ["address", "uint256"],
      [wallet1.address, signatureExpiryTimestamp],
    );
    const addressSignature = wallet2.signMessage(addressMessage);

    const setExternalWalletAction: ActionData = {
      ethValue: BigNumber.from(0),
      contractAddress: vg1.address,
      encodedFunction: vg1.interface.encodeFunctionData("setBLSKeyForWallet", [
        addressSignature,
        wallet2.PublicKey(),
        signatureExpiryTimestamp,
      ]),
    };

    // wallet 1 submits a tx
    {
      const { successes } = await vg1.callStatic.processBundle(
        wallet1.sign({
          nonce: BigNumber.from(1),
          gas: BigNumber.from(30_000_000),
          actions: [setExternalWalletAction],
        }),
      );

      expect(successes).to.deep.equal([true]);
    }

    await (
      await fx.verificationGateway.processBundle(
        wallet1.sign({
          nonce: BigNumber.from(1),
          gas: BigNumber.from(30_000_000),
          actions: [setExternalWalletAction],
        }),
      )
    ).wait();

    // wallet 1's hash is pointed to null address
    // wallet 2's hash is now pointed to wallet 1's address
    const hash2 = wallet2.blsWalletSigner.getPublicKeyHash();

    await fx.advanceTimeBy(safetyDelaySeconds + 1);

    await fx.processBundleWithExtraGas(
      wallet1.sign({
        nonce: 2,
        gas: BigNumber.from(30_000_000),
        actions: [
          {
            ethValue: 0,
            contractAddress: vg1.address,
            encodedFunction: vg1.interface.encodeFunctionData(
              "setPendingBLSKeyForWallet",
              [signatureExpiryTimestamp],
            ),
          },
        ],
      }),
    );

    await expect(vg1.walletFromHash(hash1)).to.eventually.equal(
      ethers.constants.AddressZero,
    );
    await expect(getPublicKeyFromHash(vg1, hash1)).to.eventually.deep.equal([
      "0x00",
      "0x00",
      "0x00",
      "0x00",
    ]);
    await expect(vg1.walletFromHash(hash2)).to.eventually.equal(
      wallet1.address,
    );
    await expect(vg1.hashFromWallet(wallet1.address)).to.eventually.equal(
      hash2,
    );
    expectPubkeysEql(
      await getPublicKeyFromHash(vg1, hash2),
      wallet2.PublicKey(),
    );
  });

  it("should NOT allow walletAdminCall where first param is not calling wallet", async function () {
    const wallet1 = await fx.createBLSWallet();
    const wallet2 = await fx.createBLSWallet();

    const txnReceipt = await proxyAdminCall(fx, wallet1, "upgrade", [
      wallet2.address,
      wallet2.address,
    ]);
    expectOperationFailure(txnReceipt, "VG: first param is not wallet");
  });

  it("should NOT allow walletAdminCall to ProxyAdmin.transferOwnership", async function () {
    const wallet = await fx.createBLSWallet();

    const txnReceipt = await proxyAdminCall(fx, wallet, "transferOwnership", [
      wallet.address,
    ]);
    expectOperationFailure(txnReceipt, "VG: cannot change ownership");
  });

  it("should NOT allow walletAdminCall to ProxyAdmin.renounceOwnership", async function () {
    const wallet = await fx.createBLSWallet();

    const txnReceipt = await proxyAdminCall(
      fx,
      wallet,
      "renounceOwnership",
      [],
    );
    expectOperationFailure(txnReceipt, "VG: cannot change ownership");
  });

  it("call function with no params", async function () {
    const wallet = await fx.createBLSWallet();

    const txnReceipt = await proxyAdminCall(fx, wallet, "owner", []);
    expectOperationsToSucceed(txnReceipt);
  });
});
