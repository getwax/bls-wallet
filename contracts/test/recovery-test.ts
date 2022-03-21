import { expect } from "chai";

import { ethers, network } from "hardhat";

import Fixture from "../shared/helpers/Fixture";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";
import defaultDomain from "../clients/src/signer/defaultDomain";

import { BigNumber } from "ethers";
import { authorizeSetOwner } from "./helpers/authorizations";
import { BlsWalletWrapper } from "../clients/src";
import { solidityPack } from "ethers/lib/utils";
import { solG1 } from "../clients/deps/hubble-bls/mcl";
import { BlsSignerFactory } from "../clients/deps/hubble-bls/signer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const signWalletAddress = async (
  senderAddr: string,
  signerPrivKey: string,
): Promise<solG1> => {
  const addressMessage = solidityPack(["address"], [senderAddr]);
  const blsSigner = (await BlsSignerFactory.new()).getSigner(
    defaultDomain,
    signerPrivKey,
  );
  return blsSigner.sign(addressMessage);
};

async function setOwner(
  fx: Fixture,
  wallet: BlsWalletWrapper,
  newOwner: string,
) {
  await (
    await fx.verificationGateway.processBundle(
      wallet.sign({
        nonce: await wallet.Nonce(),
        actions: [
          {
            ethValue: 0,
            contractAddress: wallet.address,
            encodedFunction: wallet.walletContract.interface.encodeFunctionData(
              "setOwner",
              [newOwner],
            ),
          },
        ],
      }),
    )
  ).wait();
}

describe("Recovery", async function () {
  this.beforeAll(async function () {
    // deploy the deployer contract for the transient hardhat network
    if (network.name === "hardhat") {
      // fund deployer wallet address
      const fundedSigner = (await ethers.getSigners())[0];
      await (
        await fundedSigner.sendTransaction({
          to: defaultDeployerAddress(),
          value: ethers.utils.parseEther("1"),
        })
      ).wait();

      // deploy the precompile contract (via deployer)
      console.log("PCE:", await deployAndRunPrecompileCostEstimator());
    }
  });

  const safetyDelaySeconds = 7 * 24 * 60 * 60;
  let fx: Fixture;
  let wallet1: BlsWalletWrapper, wallet2, walletAttacker;
  let blsWallet;
  let recoverySigner: SignerWithAddress;
  let hash1, hash2;
  let salt;
  let recoveryHash;
  beforeEach(async function () {
    fx = await Fixture.create();

    wallet1 = await fx.lazyBlsWallets[0]();
    wallet2 = await fx.lazyBlsWallets[1]();
    walletAttacker = await fx.lazyBlsWallets[2]();
    blsWallet = await ethers.getContractAt("BLSWallet", wallet1.address);
    recoverySigner = (await ethers.getSigners())[1];

    hash1 = wallet1.blsWalletSigner.getPublicKeyHash(wallet1.privateKey);
    hash2 = wallet2.blsWalletSigner.getPublicKeyHash(wallet2.privateKey);
  });

  it("should set owner", async function () {
    // Owner starts as address zero (owned by noone)
    expect(await wallet1.walletContract.owner()).to.eq(
      ethers.constants.AddressZero,
    );

    await setOwner(fx, wallet1, recoverySigner.address);

    // The first time it should work without any set up
    expect(await wallet1.walletContract.owner()).to.eq(recoverySigner.address);

    await setOwner(fx, wallet1, ethers.constants.AddressZero);

    // Second time it should fail without some set-up
    expect(await wallet1.walletContract.owner()).to.eq(recoverySigner.address);

    await (
      await fx.verificationGateway.processBundle(
        wallet1.sign({
          nonce: await wallet1.Nonce(),
          actions: [authorizeSetOwner(wallet1, ethers.constants.AddressZero)],
        }),
      )
    ).wait();

    await setOwner(fx, wallet1, ethers.constants.AddressZero);

    // Auth above is necessary but it's not valid until the delay has passed
    expect(await wallet1.walletContract.owner()).to.eq(recoverySigner.address);

    await fx.advanceTimeBy(safetyDelaySeconds);

    await setOwner(fx, wallet1, ethers.constants.AddressZero);

    expect(await wallet1.walletContract.owner()).to.eq(
      ethers.constants.AddressZero,
    );
  });

  it("should recover before bls key update", async function () {
    await fx.call(wallet1, blsWallet, "setRecoveryHash", [recoveryHash], 1);
    const attackKey = walletAttacker.PublicKey();

    // Attacker assumed to have compromised current bls key, and wishes to reset
    // the contract's bls key to their own.
    await fx.call(wallet1, blsWallet, "setBLSPublicKey", [attackKey], 2);

    await fx.advanceTimeBy(safetyDelaySeconds / 2); // wait half the time
    await (await blsWallet.setAnyPending()).wait();

    const addressSignature = await signWalletAddress(
      wallet1.address,
      wallet2.privateKey,
    );
    const safeKey = wallet2.PublicKey();

    await (
      await fx.verificationGateway
        .connect(recoverySigner)
        .recoverWallet(addressSignature, hash1, salt, safeKey)
    ).wait();

    // key reset via recovery
    expect(await blsWallet.getBLSPublicKey()).to.eql(
      safeKey.map(BigNumber.from),
    );

    await fx.advanceTimeBy(safetyDelaySeconds / 2 + 1); // wait remainder the time

    // attacker's key not set after waiting full safety delay
    expect(await blsWallet.getBLSPublicKey()).to.eql(
      safeKey.map(BigNumber.from),
    );

    let walletFromKey = await fx.verificationGateway.walletFromHash(
      wallet1.blsWalletSigner.getPublicKeyHash(wallet1.privateKey),
    );
    expect(walletFromKey).to.not.equal(blsWallet.address);
    walletFromKey = await fx.verificationGateway.walletFromHash(
      walletAttacker.blsWalletSigner.getPublicKeyHash(
        walletAttacker.privateKey,
      ),
    );
    expect(walletFromKey).to.not.equal(blsWallet.address);
    walletFromKey = await fx.verificationGateway.walletFromHash(
      wallet2.blsWalletSigner.getPublicKeyHash(wallet2.privateKey),
    );
    expect(walletFromKey).to.equal(blsWallet.address);

    // verify recovered bls key can successfully call wallet-only function (eg setTrustedGateway)
    const res = await fx.callStatic(
      wallet2,
      fx.verificationGateway,
      "setTrustedBLSGateway",
      [hash2, fx.verificationGateway.address],
      3,
    );
    expect(res.successes[0]).to.equal(true);
  });

  // https://github.com/jzaki/bls-wallet/issues/141
  it("should NOT be able to recover to another wallet", async function () {
    const attackerWalletContract = await ethers.getContractAt(
      "BLSWallet",
      walletAttacker.address,
    );
    const hashAttacker = walletAttacker.blsWalletSigner.getPublicKeyHash(
      walletAttacker.privateKey,
    );
    const attackerRecoveryHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "bytes32"],
      [recoverySigner.address, hashAttacker, salt],
    );

    // Attacker puts their wallet into recovery
    await fx.call(
      walletAttacker,
      attackerWalletContract,
      "setRecoveryHash",
      [attackerRecoveryHash],
      1,
    );

    // Attacker waits out safety delay
    await fx.advanceTimeBy(safetyDelaySeconds + 1);
    await (await attackerWalletContract.setAnyPending()).wait();

    const addressSignature = await signWalletAddress(
      walletAttacker.address,
      walletAttacker.privateKey,
    );
    const wallet1Key = await wallet1.PublicKey();

    // Attacker attempts to overwite wallet 1's public key and fails
    await expect(
      fx.verificationGateway
        .connect(recoverySigner)
        .recoverWallet(addressSignature, hashAttacker, salt, wallet1Key),
    ).to.be.rejectedWith("VG: Signature not verified for wallet address");
  });
});
