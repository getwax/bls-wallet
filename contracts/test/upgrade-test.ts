import { expect } from "chai";
import { BigNumber, ContractReceipt } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import { ethers, network } from "hardhat";

import {
  ActionData,
  BlsWalletWrapper,
  getOperationResults,
} from "../clients/src";
import Fixture from "../shared/helpers/Fixture";
import {
  proxyAdminBundle,
  proxyAdminCall,
} from "../shared/helpers/callProxyAdmin";
import deploy from "../shared/deploy";

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
  let fx: Fixture;
  beforeEach(async () => {
    fx ??= await Fixture.create();
  });

  it("should upgrade wallet contract", async () => {
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
    expectOperationsToSucceed(txnReceipt1);

    // Advance time one week
    const latestTimestamp = (await ethers.provider.getBlock("latest"))
      .timestamp;
    await network.provider.send("evm_setNextBlockTimestamp", [
      BigNumber.from(latestTimestamp)
        .add(safetyDelaySeconds + 1)
        .toHexString(),
    ]);

    // make call
    const txnReceipt2 = await proxyAdminCall(fx, wallet, "upgrade", [
      wallet.address,
      mockWalletUpgraded.address,
    ]);
    expectOperationsToSucceed(txnReceipt2);

    const newBLSWallet = MockWalletUpgraded.attach(wallet.address);
    await (await newBLSWallet.setNewData(wallet.address)).wait();
    expect(await newBLSWallet.newData()).to.equal(wallet.address);
  });

  it("should register with new verification gateway", async () => {
    // Deploy new verification gateway

    const [signer] = await ethers.getSigners();

    const deployment2 = await deploy(
      signer,
      ethers.utils.solidityPack(["uint256"], [2]),
    );

    const vg2 = deployment2.verificationGateway;

    // Recreate hubble bls signer
    const walletOldVg = await fx.lazyBlsWallets[0]();
    const walletAddress = walletOldVg.address;
    const blsSecret = walletOldVg.privateKey;

    const wallet = await BlsWalletWrapper.connect(
      blsSecret,
      fx.verificationGateway.address,
      fx.verificationGateway.provider,
    );
    // Sign simple address message
    const addressMessage = solidityPack(["address"], [walletAddress]);
    const addressSignature = wallet.signMessage(addressMessage);

    const proxyAdmin2Address = await vg2.walletProxyAdmin();
    // Get admin action to change proxy
    const bundle = await proxyAdminBundle(fx, walletOldVg, "changeProxyAdmin", [
      walletAddress,
      proxyAdmin2Address,
    ]);
    const changeProxyAction = bundle.operations[0].actions[0];

    // prepare call
    const txnReceipt = await proxyAdminCall(
      fx,
      walletOldVg,
      "changeProxyAdmin",
      [walletAddress, proxyAdmin2Address],
    );
    expectOperationsToSucceed(txnReceipt);

    // Advance time one week
    await fx.advanceTimeBy(safetyDelaySeconds + 1);

    const hash = walletOldVg.blsWalletSigner.getPublicKeyHash(
      walletOldVg.privateKey,
    );

    const setExternalWalletAction: ActionData = {
      ethValue: BigNumber.from(0),
      contractAddress: vg2.address,
      encodedFunction: vg2.interface.encodeFunctionData("setBLSKeyForWallet", [
        addressSignature,
        walletOldVg.PublicKey(),
      ]),
    };

    const setTrustedBLSGatewayAction: ActionData = {
      ethValue: BigNumber.from(0),
      contractAddress: fx.verificationGateway.address,
      encodedFunction: fx.verificationGateway.interface.encodeFunctionData(
        "setTrustedBLSGateway",
        [hash, vg2.address],
      ),
    };

    // Upgrading the gateway requires these three steps:
    //  1. register external wallet in vg2
    //  2. change proxy admin to that in vg2
    //  3. lastly, set wallet's new trusted gateway
    //
    // If (1) or (2) are skipped, then (3) should fail, and therefore the whole
    // operation should fail.

    {
      // Fail if setExternalWalletAction is skipped

      const { successes } =
        await fx.verificationGateway.callStatic.processBundle(
          walletOldVg.sign({
            nonce: BigNumber.from(2),
            actions: [
              // skip: setExternalWalletAction,
              changeProxyAction,
              setTrustedBLSGatewayAction,
            ],
          }),
        );

      expect(successes).to.deep.equal([false]);
    }

    {
      // Fail if changeProxyAction is skipped

      const { successes } =
        await fx.verificationGateway.callStatic.processBundle(
          walletOldVg.sign({
            nonce: BigNumber.from(2),
            actions: [
              setExternalWalletAction,
              // skip: changeProxyAction,
              setTrustedBLSGatewayAction,
            ],
          }),
        );

      expect(successes).to.deep.equal([false]);
    }

    {
      // Succeed if nothing is skipped

      const { successes } =
        await fx.verificationGateway.callStatic.processBundle(
          walletOldVg.sign({
            nonce: BigNumber.from(2),
            actions: [
              setExternalWalletAction,
              changeProxyAction,
              setTrustedBLSGatewayAction,
            ],
          }),
        );

      expect(successes).to.deep.equal([true]);
    }

    expect(await vg2.walletFromHash(hash)).not.to.equal(walletAddress);

    const upgradeBundle = walletOldVg.sign({
      nonce: BigNumber.from(2),
      actions: [
        setExternalWalletAction,
        changeProxyAction,
        setTrustedBLSGatewayAction,
      ],
    });

    const gasEstimate = await fx.verificationGateway.estimateGas.processBundle(
      upgradeBundle,
    );

    // There seems to be a bug where the automatic gas limit is not enough here,
    // so make it plenty instead.
    const gasLimit = gasEstimate.add(gasEstimate.div(2));

    // Now actually perform the upgrade so we can perform some more detailed
    // checks.
    await (
      await fx.verificationGateway.processBundle(upgradeBundle, {
        gasLimit,
      })
    ).wait();

    // Create required objects for data/contracts for checks
    const proxyAdmin = await ethers.getContractAt(
      "ProxyAdmin",
      await vg2.walletProxyAdmin(),
    );

    // Direct checks corresponding to each action
    expect(await vg2.walletFromHash(hash)).to.equal(walletAddress);
    expect(await vg2.hashFromWallet(walletAddress)).to.equal(hash);
    expect(await proxyAdmin.getProxyAdmin(walletAddress)).to.equal(
      proxyAdmin.address,
    );

    const blsWallet = await ethers.getContractAt("BLSWallet", walletAddress);
    // New verification gateway pending
    expect(await blsWallet.trustedBLSGateway()).to.equal(
      fx.verificationGateway.address,
    );
    // Advance time one week
    await fx.advanceTimeBy(safetyDelaySeconds + 1);
    // set pending
    await (await blsWallet.setAnyPending()).wait();
    // Check new verification gateway was set
    expect(await blsWallet.trustedBLSGateway()).to.equal(vg2.address);

    // Check new gateway has wallet via static call through new gateway
    const bundleResult = await vg2.callStatic.processBundle(
      fx.blsWalletSigner.aggregate([
        walletOldVg.sign({
          nonce: BigNumber.from(3),
          actions: [
            {
              ethValue: 0,
              contractAddress: vg2.address,
              encodedFunction: vg2.interface.encodeFunctionData(
                "walletFromHash",
                [hash],
              ),
            },
          ],
        }),
      ]),
    );
    const walletFromHashAddress = ethers.utils.defaultAbiCoder.decode(
      ["address"],
      bundleResult.results[0][0], // first and only operation/action result
    )[0];
    expect(walletFromHashAddress).to.equal(walletAddress);
  });

  it("should change mapping of an address to hash", async () => {
    const vg1 = fx.verificationGateway;

    const wallet1 = await fx.createBLSWallet();
    const wallet2 = await fx.createBLSWallet();

    // Process an empty operation for wallet1 so that the gateway knows about
    // its hash mapping
    await (
      await fx.verificationGateway.processBundle(
        wallet1.sign({
          nonce: 0,
          actions: [],
        }),
      )
    ).wait();

    const hash1 = wallet1.blsWalletSigner.getPublicKeyHash(wallet1.privateKey);

    expect(await vg1.walletFromHash(hash1)).to.equal(wallet1.address);
    expect(await vg1.hashFromWallet(wallet1.address)).to.equal(hash1);

    // wallet 2 bls key signs message containing address of wallet 1
    const addressMessage = solidityPack(["address"], [wallet1.address]);
    const addressSignature = wallet2.signMessage(addressMessage);

    const setExternalWalletAction: ActionData = {
      ethValue: BigNumber.from(0),
      contractAddress: vg1.address,
      encodedFunction: vg1.interface.encodeFunctionData("setBLSKeyForWallet", [
        addressSignature,
        wallet2.PublicKey(),
      ]),
    };

    // wallet 1 submits a tx
    {
      const { successes } = await vg1.callStatic.processBundle(
        wallet1.sign({
          nonce: BigNumber.from(1),
          actions: [setExternalWalletAction],
        }),
      );

      expect(successes).to.deep.equal([true]);
    }

    await (
      await fx.verificationGateway.processBundle(
        wallet1.sign({
          nonce: BigNumber.from(1),
          actions: [setExternalWalletAction],
        }),
      )
    ).wait();

    // wallet 1's hash is pointed to null address
    // wallet 2's hash is now pointed to wallet 1's address
    const hash2 = wallet2.blsWalletSigner.getPublicKeyHash(wallet2.privateKey);

    await fx.advanceTimeBy(safetyDelaySeconds + 1);

    const setPendingBundle = wallet1.sign({
      nonce: 2,
      actions: [
        {
          ethValue: 0,
          contractAddress: vg1.address,
          encodedFunction: vg1.interface.encodeFunctionData(
            "setPendingBLSKeyForWallet",
          ),
        },
      ],
    });

    const gasEstimate = await fx.verificationGateway.estimateGas.processBundle(
      setPendingBundle,
    );

    // There seems to be a bug where the automatic gas limit is not enough here,
    // so make it plenty instead.
    const gasLimit = gasEstimate.add(gasEstimate.div(2));

    await fx.verificationGateway.processBundle(setPendingBundle, {
      gasLimit,
    });

    expect(await vg1.walletFromHash(hash1)).to.equal(
      ethers.constants.AddressZero,
    );
    expect(await vg1.walletFromHash(hash2)).to.equal(wallet1.address);
    expect(await vg1.hashFromWallet(wallet1.address)).to.equal(hash2);
  });

  it("should NOT allow walletAdminCall where first param is not calling wallet", async function () {
    const wallet1 = await fx.createBLSWallet();
    const wallet2 = await fx.createBLSWallet();

    const txnReceipt = await proxyAdminCall(fx, wallet1, "upgrade", [
      wallet2.address,
      wallet2.address,
    ]);
    expectOperationFailure(
      txnReceipt,
      "VG: first param to proxy admin is not calling wallet",
    );
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
