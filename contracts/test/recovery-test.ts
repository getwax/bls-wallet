import { expect } from "chai";
import { BigNumber } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import { ethers, network } from "hardhat";

import { BlsWalletWrapper, Signature } from "../clients/src";
import Fixture from "../shared/helpers/Fixture";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";
import { BLSWallet, VerificationGateway } from "../typechain-types";

const signWalletAddress = async (
  fx: Fixture,
  senderAddr: string,
  signerPrivKey: string,
): Promise<Signature> => {
  const addressMessage = solidityPack(["address"], [senderAddr]);
  const wallet = await BlsWalletWrapper.connect(
    signerPrivKey,
    fx.verificationGateway.address,
    fx.verificationGateway.provider,
  );
  return wallet.signMessage(addressMessage);
};

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
  let vg: VerificationGateway;
  let wallet1: BlsWalletWrapper;
  let wallet2: BlsWalletWrapper;
  let wallet3: BlsWalletWrapper;
  let walletAttacker: BlsWalletWrapper;
  let blsWallet: BLSWallet;
  let blsWallet3: BLSWallet;
  let recoverySigner;
  let hash1, hash2, hashAttacker;
  let salt;
  let recoveryHash;
  beforeEach(async function () {
    fx = await Fixture.create();
    vg = fx.verificationGateway;

    wallet1 = await fx.lazyBlsWallets[0]();
    wallet2 = await fx.lazyBlsWallets[1]();
    wallet3 = await fx.lazyBlsWallets[2]();
    walletAttacker = await fx.lazyBlsWallets[2]();
    blsWallet = await ethers.getContractAt("BLSWallet", wallet1.address);
    blsWallet3 = await ethers.getContractAt("BLSWallet", wallet3.address);
    recoverySigner = (await ethers.getSigners())[1];

    hash1 = wallet1.blsWalletSigner.getPublicKeyHash(wallet1.privateKey);
    hash2 = wallet2.blsWalletSigner.getPublicKeyHash(wallet2.privateKey);
    hashAttacker = wallet2.blsWalletSigner.getPublicKeyHash(
      walletAttacker.privateKey,
    );
    salt = "0x1234567812345678123456781234567812345678123456781234567812345678";
    recoveryHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "bytes32"],
      [recoverySigner.address, hash1, salt],
    );
  });

  it("should update bls key", async function () {
    expect(await vg.hashFromWallet(wallet1.address)).to.eql(hash1);

    const addressSignature = await signWalletAddress(
      fx,
      wallet1.address,
      wallet2.privateKey,
    );

    await fx.call(
      wallet1,
      vg,
      "setBLSKeyForWallet",
      [addressSignature, wallet2.PublicKey()],
      1,
    );

    await fx.advanceTimeBy(safetyDelaySeconds + 1);
    await fx.call(wallet1, vg, "setPendingBLSKeyForWallet", [], 2);

    expect(await vg.hashFromWallet(wallet1.address)).to.eql(hash2);
  });

  it("should NOT override public key hash after creation", async function () {
    let walletForHash = await vg.walletFromHash(hash1);
    expect(BigNumber.from(walletForHash)).to.not.equal(BigNumber.from(0));
    expect(walletForHash).to.equal(wallet1.address);

    let hashFromWallet = await vg.hashFromWallet(wallet1.address);
    expect(BigNumber.from(hashFromWallet)).to.not.equal(BigNumber.from(0));
    expect(hashFromWallet).to.equal(hash1);

    await fx.call(wallet1, vg, "setPendingBLSKeyForWallet", [], 1);

    walletForHash = await vg.walletFromHash(hash1);
    expect(walletForHash).to.equal(wallet1.address);

    hashFromWallet = await vg.hashFromWallet(wallet1.address);
    expect(hashFromWallet).to.equal(hash1);
  });

  it("should set recovery hash", async function () {
    // set instantly from 0 value
    await fx.call(wallet1, blsWallet, "setRecoveryHash", [recoveryHash], 1);
    expect(await blsWallet.recoveryHash()).to.equal(recoveryHash);

    // new value set after delay from non-zero value
    salt = "0x" + "AB".repeat(32);
    const newRecoveryHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "bytes32"],
      [recoverySigner.address, hash1, salt],
    );
    await fx.call(wallet1, blsWallet, "setRecoveryHash", [newRecoveryHash], 2);
    expect(await blsWallet.recoveryHash()).to.equal(recoveryHash);
    await fx.advanceTimeBy(safetyDelaySeconds + 1);
    await (await blsWallet.setAnyPending()).wait();
    expect(await blsWallet.recoveryHash()).to.equal(newRecoveryHash);
  });

  it("should set recovery hash using client bls wallet wrapper function", async function () {
    // set instantly from 0 value
    const trustedWalletAddress = "0x7321d1D33E94f294c144aA332f75411372741d33";
    const walletHash = await vg.hashFromWallet(wallet3.address);
    const salt = "test salt";
    const saltHash = ethers.utils.formatBytes32String(salt);
    const recoveryHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "bytes32"],
      [trustedWalletAddress, walletHash, saltHash],
    );

    const bundle = await wallet3.getSetRecoveryHashBundle(
      "test salt",
      trustedWalletAddress,
    );
    const bundleTxn = await fx.verificationGateway.processBundle(bundle);
    await bundleTxn.wait();

    expect(await blsWallet3.recoveryHash()).to.equal(recoveryHash);
  });

  it("should recover blswallet via blswallet to new bls key using bls client module", async function () {
    // Set recovery hash
    const wallet4 = await fx.lazyBlsWallets[3]();
    const bundle = await wallet4.getSetRecoveryHashBundle(
      "test salt",
      wallet3.address,
    );
    const bundleTxn = await fx.verificationGateway.processBundle(bundle);
    await bundleTxn.wait();

    // Recover wallet
    const newPrivateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();
    const recoveryBundle = await wallet3.getRecoverWalletBundle(
      wallet4.address,
      newPrivateKey,
      "test salt",
      fx.verificationGateway,
    );
    const recoveryBundleTxn = await fx.verificationGateway.processBundle(
      recoveryBundle,
    );
    await recoveryBundleTxn.wait();

    const newHash = wallet4.blsWalletSigner.getPublicKeyHash(newPrivateKey);
    expect(await vg.hashFromWallet(wallet4.address)).to.eql(newHash);
    expect(await vg.walletFromHash(newHash)).to.eql(wallet4.address);
  });

  it("should recover blswallet via blswallet to new bls key", async function () {
    // wallet1 to recover via wallet2 to key 3

    // wallet 2 address is recovery address of wallet 1
    recoveryHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "bytes32"],
      [wallet2.address, hash1, salt],
    );
    let w1Nonce = 1;
    await fx.call(
      wallet1,
      blsWallet,
      "setRecoveryHash",
      [recoveryHash],
      w1Nonce++,
    );

    // key 3 signs wallet 1 address
    const wallet3 = await fx.lazyBlsWallets[2]();
    const addressSignature = await signWalletAddress(
      fx,
      wallet1.address,
      wallet3.privateKey,
    );

    // wallet 2 recovers wallet 1 to key 3
    let w2Nonce = 1;
    await fx.call(
      wallet2,
      vg,
      "recoverWallet",
      [addressSignature, hash1, salt, wallet3.PublicKey()],
      w2Nonce++,
    );

    // don't trust, verify
    const hash3 = wallet3.blsWalletSigner.getPublicKeyHash(wallet3.privateKey);
    expect(await vg.hashFromWallet(wallet1.address)).to.eql(hash3);
    expect(await vg.walletFromHash(hash3)).to.eql(wallet1.address);
  });

  it("should recover before bls key update", async function () {
    let recoveredWalletNonce = 1;
    await fx.call(
      wallet1,
      blsWallet,
      "setRecoveryHash",
      [recoveryHash],
      recoveredWalletNonce++,
    );

    const attackSignature = await signWalletAddress(
      fx,
      wallet1.address,
      walletAttacker.privateKey,
    );

    // Attacker assumed to have compromised wallet1 bls key, and wishes to reset
    // the gateway wallet's bls key to their own.
    await fx.call(
      wallet1,
      vg,
      "setBLSKeyForWallet",
      [attackSignature, walletAttacker.PublicKey()],
      recoveredWalletNonce++,
    );

    const pendingKey = await Promise.all(
      [0, 1, 2, 3].map(async (i) =>
        (await vg.pendingBLSPublicKeyFromHash(hash1, i)).toHexString(),
      ),
    );

    const attackerPublicKeyHexStrings = walletAttacker
      .PublicKey()
      .map((keyElement) => BigNumber.from(keyElement).toHexString());

    expect(pendingKey).to.deep.equal(attackerPublicKeyHexStrings);

    await fx.advanceTimeBy(safetyDelaySeconds / 2); // wait half the time
    // NB: advancing the time makes an empty tx with lazywallet[1]
    // Here this seems to be wallet2, not wallet (wallet being recovered)
    // recoveredWalletNonce++

    await fx.call(
      wallet1,
      vg,
      "setPendingBLSKeyForWallet",
      [],
      recoveredWalletNonce++,
    );

    const addressSignature = await signWalletAddress(
      fx,
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
    expect(await vg.hashFromWallet(wallet1.address)).to.eql(hash2);
    expect(await vg.walletFromHash(hash2)).to.eql(wallet1.address);

    await fx.advanceTimeBy(safetyDelaySeconds / 2 + 1); // wait remainder the time
    // NB: advancing the time makes an empty tx with lazywallet[1]
    // Here this seems to be wallet1, the wallet being recovered
    recoveredWalletNonce++;

    // check attacker's key not set after waiting full safety delay
    await fx.call(
      walletAttacker,
      vg,
      "setPendingBLSKeyForWallet",
      [],
      await walletAttacker.Nonce(),
    );
    /**
     * TODO (merge-ok)
     *
     * Event thought typechain types are symlinked between contracts
     * and clients, there appears to be a mismatch here passing in
     * VerificationGateway. This may be due to differing typescript
     * versions between contracts and clients, or something else.
     *
     * For now cast to 'any'.
     */
    await wallet2.syncWallet(vg as any);
    await fx.call(
      wallet2,
      vg,
      "setPendingBLSKeyForWallet",
      [],
      recoveredWalletNonce++, // await wallet2.Nonce(),
    );

    expect(await vg.walletFromHash(hash1)).to.not.equal(blsWallet.address);
    expect(await vg.walletFromHash(hashAttacker)).to.not.equal(
      blsWallet.address,
    );
    expect(await vg.walletFromHash(hash2)).to.equal(blsWallet.address);

    // // verify recovered bls key can successfully call wallet-only function (eg setTrustedGateway)
    const res = await fx.callStatic(
      wallet2,
      vg,
      "setTrustedBLSGateway",
      [hash2, vg.address],
      recoveredWalletNonce, // await wallet2.Nonce(),
    );
    expect(res.successes[0]).to.equal(true);
  });

  // https://github.com/jzaki/bls-wallet/issues/141
  it("should NOT be able to recover to another wallet", async function () {
    const attackerWalletContract = await ethers.getContractAt(
      "BLSWallet",
      walletAttacker.address,
    );

    // Attacker users recovery signer to set their recovery hash
    const attackerRecoveryHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "bytes32"],
      [recoverySigner.address, hashAttacker, salt],
    );
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
    expect(await attackerWalletContract.recoveryHash()).to.equal(
      attackerRecoveryHash,
    );

    const addressSignature = await signWalletAddress(
      fx,
      walletAttacker.address,
      walletAttacker.privateKey,
    );
    const wallet1Key = await wallet1.PublicKey();

    // Attacker attempts to overwrite wallet 1's hash in the gateway and fails
    await expect(
      fx.verificationGateway
        .connect(recoverySigner)
        .recoverWallet(addressSignature, hashAttacker, salt, wallet1Key),
    ).to.be.rejectedWith("VG: Signature not verified for wallet address");
  });

  it("should NOT allow a bundle to be executed on a wallet with the same BLS pubkey but different address (replay attack)", async function () {
    // Run empty operation on wallet 2 to align nonces after recovery.
    const emptyBundle = wallet2.sign({
      nonce: await wallet2.Nonce(),
      actions: [],
    });
    const emptyBundleTxn = await fx.verificationGateway.processBundle(
      emptyBundle,
    );
    await emptyBundleTxn.wait();

    // Set wallet 1's pubkey to wallet 2's through recovery
    // This will also unregister wallet 2 from VG
    await fx.call(wallet1, blsWallet, "setRecoveryHash", [recoveryHash], 1);

    const addressSignature = await signWalletAddress(
      fx,
      wallet1.address,
      wallet2.privateKey,
    );

    const recoveryTxn = await fx.verificationGateway
      .connect(recoverySigner)
      .recoverWallet(addressSignature, hash1, salt, wallet2.PublicKey());
    await recoveryTxn.wait();

    const [wallet1PubkeyHash, wallet2PubkeyHash, wallet1Nonce, wallet2Nonce] =
      await Promise.all([
        vg.hashFromWallet(wallet1.address),
        vg.hashFromWallet(wallet2.address),
        wallet1.Nonce(),
        wallet2.Nonce(),
      ]);
    expect(wallet1PubkeyHash).to.eql(hash2);
    expect(wallet2PubkeyHash).to.eql(hash2);
    expect(wallet1Nonce.toNumber()).to.eql(wallet2Nonce.toNumber());

    // Attempt to run a bundle from wallet 2 through wallet 1
    // Signiuture verification should fail as addresses differ
    const invalidBundle = wallet2.sign({
      nonce: await wallet2.Nonce(),
      actions: [],
    });
    await expect(
      fx.verificationGateway.processBundle(invalidBundle),
    ).to.be.rejectedWith("VG: Sig not verified");
  });
});
