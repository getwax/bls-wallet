import { expect } from "chai";
import { BigNumber } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { BlsWalletWrapper, Signature } from "../clients/src";
import Fixture from "../shared/helpers/Fixture";
import getPublicKeyFromHash from "../shared/helpers/getPublicKeyFromHash";
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
    fx = await Fixture.getSingleton();
    vg = fx.verificationGateway;

    wallet1 = await fx.createBLSWallet();
    wallet2 = await fx.createBLSWallet();
    wallet3 = await fx.createBLSWallet();
    walletAttacker = wallet3;
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
    await (
      await vg.processBundle(
        wallet1.sign({
          nonce: 0,
          gas: 30_000_000,
          actions: [],
        }),
      )
    ).wait();

    await expect(vg.hashFromWallet(wallet1.address)).to.eventually.eql(hash1);

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
      30_000_000,
    );

    await fx.advanceTimeBy(safetyDelaySeconds + 1);
    await fx.processBundleWithExtraGas(
      wallet1.sign({
        nonce: await wallet1.Nonce(),
        gas: 30_000_000,
        actions: [
          {
            ethValue: 0,
            contractAddress: vg.address,
            encodedFunction: vg.interface.encodeFunctionData(
              "setPendingBLSKeyForWallet",
            ),
          },
        ],
      }),
    );

    await expect(vg.hashFromWallet(wallet1.address)).to.eventually.eql(hash2);
  });

  it("should NOT override public key hash after creation", async function () {
    await (
      await vg.processBundle(
        wallet1.sign({
          nonce: 0,
          gas: 30_000_000,
          actions: [],
        }),
      )
    ).wait();

    let walletForHash = await vg.walletFromHash(hash1);
    expect(BigNumber.from(walletForHash)).to.not.equal(BigNumber.from(0));
    expect(walletForHash).to.equal(wallet1.address);

    let hashFromWallet = await vg.hashFromWallet(wallet1.address);
    expect(BigNumber.from(hashFromWallet)).to.not.equal(BigNumber.from(0));
    expect(hashFromWallet).to.equal(hash1);

    let publicKeyFromHash = await getPublicKeyFromHash(vg, hash1);
    expect(publicKeyFromHash).to.deep.equal(wallet1.PublicKey());

    await fx.advanceTimeBy(safetyDelaySeconds + 1);
    await fx.processBundleWithExtraGas(
      wallet1.sign({
        nonce: await wallet1.Nonce(),
        gas: 30_000_000,
        actions: [
          {
            ethValue: 0,
            contractAddress: vg.address,
            encodedFunction: vg.interface.encodeFunctionData(
              "setPendingBLSKeyForWallet",
            ),
          },
        ],
      }),
    );

    walletForHash = await vg.walletFromHash(hash1);
    expect(walletForHash).to.equal(wallet1.address);

    hashFromWallet = await vg.hashFromWallet(wallet1.address);
    expect(hashFromWallet).to.equal(hash1);

    publicKeyFromHash = await getPublicKeyFromHash(vg, hash1);
    expect(publicKeyFromHash).to.deep.equal(wallet1.PublicKey());
  });

  it("should set recovery hash", async function () {
    // set instantly from 0 value
    await fx.call(
      wallet1,
      blsWallet,
      "setRecoveryHash",
      [recoveryHash],
      0,
      30_000_000,
    );
    await expect(blsWallet.recoveryHash()).to.eventually.equal(recoveryHash);

    // new value set after delay from non-zero value
    salt = "0x" + "AB".repeat(32);
    const newRecoveryHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "bytes32"],
      [recoverySigner.address, hash1, salt],
    );
    await fx.call(
      wallet1,
      blsWallet,
      "setRecoveryHash",
      [newRecoveryHash],
      1,
      30_000_000,
    );
    await expect(blsWallet.recoveryHash()).to.eventually.equal(recoveryHash);
    await fx.advanceTimeBy(safetyDelaySeconds + 1);
    await (await blsWallet.setAnyPending()).wait();
    await expect(blsWallet.recoveryHash()).to.eventually.equal(newRecoveryHash);
  });

  it("should set recovery hash using client bls wallet wrapper function", async function () {
    await (
      await vg.processBundle(
        wallet3.sign({
          nonce: 0,
          gas: 30_000_000,
          actions: [],
        }),
      )
    ).wait();

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
    await (
      await vg.processBundle(
        wallet3.sign({
          nonce: 0,
          gas: 30_000_000,
          actions: [],
        }),
      )
    ).wait();

    // Set recovery hash
    const wallet4 = await fx.createBLSWallet();
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
    await fx.processBundleWithExtraGas(recoveryBundle);

    const newHash = wallet4.blsWalletSigner.getPublicKeyHash(newPrivateKey);
    const newPublicKey = wallet4.blsWalletSigner.getPublicKey(newPrivateKey);
    expect(await vg.hashFromWallet(wallet4.address)).to.eql(newHash);
    expect(await vg.walletFromHash(newHash)).to.eql(wallet4.address);
    expect(await getPublicKeyFromHash(vg, newHash)).to.deep.equal(newPublicKey);
  });

  it("should recover blswallet via blswallet to new bls key", async function () {
    // wallet1 to recover via wallet2 to key 3

    // wallet 2 address is recovery address of wallet 1
    recoveryHash = ethers.utils.solidityKeccak256(
      ["address", "bytes32", "bytes32"],
      [wallet2.address, hash1, salt],
    );
    let w1Nonce = 0;
    await fx.call(
      wallet1,
      blsWallet,
      "setRecoveryHash",
      [recoveryHash],
      w1Nonce++,
      30_000_000,
    );

    // key 3 signs wallet 1 address
    const wallet3 = await fx.createBLSWallet();
    const addressSignature = await signWalletAddress(
      fx,
      wallet1.address,
      wallet3.privateKey,
    );

    // wallet 2 recovers wallet 1 to key 3
    await fx.processBundleWithExtraGas(
      wallet2.sign({
        nonce: await wallet2.Nonce(),
        gas: 30_000_000,
        actions: [
          {
            ethValue: 0,
            contractAddress: vg.address,
            encodedFunction: vg.interface.encodeFunctionData("recoverWallet", [
              addressSignature,
              hash1,
              salt,
              wallet3.PublicKey(),
            ]),
          },
        ],
      }),
    );

    // don't trust, verify
    const hash3 = wallet3.blsWalletSigner.getPublicKeyHash(wallet3.privateKey);
    await expect(vg.hashFromWallet(wallet1.address)).to.eventually.eql(hash3);
    await expect(vg.walletFromHash(hash3)).to.eventually.eql(wallet1.address);
    await expect(getPublicKeyFromHash(vg, hash3)).to.eventually.deep.equal(
      wallet3.PublicKey(),
    );
  });

  it("should recover before bls key update", async function () {
    let recoveredWalletNonce = 0;
    await fx.call(
      wallet1,
      blsWallet,
      "setRecoveryHash",
      [recoveryHash],
      recoveredWalletNonce++,
      30_000_000,
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
      30_000_000,
    );
    const pendingKey = await Promise.all(
      [0, 1, 2, 3].map(async (i) =>
        (await vg.pendingBLSPublicKeyFromHash(hash1, i)).toHexString(),
      ),
    );
    expect(pendingKey).to.deep.equal(walletAttacker.PublicKey());

    await fx.advanceTimeBy(safetyDelaySeconds / 2); // wait half the time
    // NB: advancing the time makes an empty tx with lazywallet[1]
    // Here this seems to be wallet2, not wallet (wallet being recovered)
    // recoveredWalletNonce++

    await fx.processBundleWithExtraGas(
      wallet1.sign({
        nonce: await wallet1.Nonce(),
        gas: 30_000_000,
        actions: [
          {
            ethValue: 0,
            contractAddress: vg.address,
            encodedFunction: vg.interface.encodeFunctionData(
              "setPendingBLSKeyForWallet",
            ),
          },
        ],
      }),
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
    await expect(vg.hashFromWallet(wallet1.address)).to.eventually.eql(hash2);
    await expect(vg.walletFromHash(hash2)).to.eventually.eql(wallet1.address);
    await expect(getPublicKeyFromHash(vg, hash2)).to.eventually.deep.equal(
      safeKey,
    );

    await fx.advanceTimeBy(safetyDelaySeconds / 2 + 1); // wait remainder the time
    // NB: advancing the time makes an empty tx with lazywallet[1]
    // Here this seems to be wallet1, the wallet being recovered
    recoveredWalletNonce++;

    // check attacker's key not set after waiting full safety delay
    await fx.processBundleWithExtraGas(
      walletAttacker.sign({
        nonce: await walletAttacker.Nonce(),
        gas: 30_000_000,
        actions: [
          {
            ethValue: 0,
            contractAddress: vg.address,
            encodedFunction: vg.interface.encodeFunctionData(
              "setPendingBLSKeyForWallet",
            ),
          },
        ],
      }),
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
    await fx.processBundleWithExtraGas(
      wallet2.sign({
        nonce: await wallet2.Nonce(),
        gas: 30_000_000,
        actions: [
          {
            ethValue: 0,
            contractAddress: vg.address,
            encodedFunction: vg.interface.encodeFunctionData(
              "setPendingBLSKeyForWallet",
            ),
          },
        ],
      }),
    );

    await expect(vg.walletFromHash(hash1)).to.eventually.not.equal(
      blsWallet.address,
    );
    await expect(getPublicKeyFromHash(vg, hash1)).to.eventually.not.deep.equal(
      wallet1.PublicKey(),
    );

    await expect(vg.walletFromHash(hashAttacker)).to.eventually.not.equal(
      blsWallet.address,
    );
    await expect(vg.walletFromHash(hash2)).to.eventually.equal(
      blsWallet.address,
    );

    // // verify recovered bls key can successfully call wallet-only function (eg setTrustedGateway)
    const res = await fx.callStatic(
      wallet2,
      vg,
      "setTrustedBLSGateway",
      [hash2, vg.address],
      await wallet2.Nonce(),
      30_000_000,
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
      0,
      30_000_000,
    );

    // Attacker waits out safety delay
    await fx.advanceTimeBy(safetyDelaySeconds + 1);
    await (await attackerWalletContract.setAnyPending()).wait();
    await expect(attackerWalletContract.recoveryHash()).to.eventually.equal(
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
    ).to.be.rejectedWith("VG: Sig not verified");
  });

  it("should NOT allow a bundle to be executed on a wallet with the same BLS pubkey but different address (replay attack)", async function () {
    // Run empty operation on wallet 2 to align nonces after recovery.
    const emptyBundle = wallet2.sign({
      nonce: await wallet2.Nonce(),
      gas: 30_000_000,
      actions: [],
    });
    const emptyBundleTxn = await fx.verificationGateway.processBundle(
      emptyBundle,
    );
    await emptyBundleTxn.wait();

    // Set wallet 1's pubkey to wallet 2's through recovery
    // This will also unregister wallet 2 from VG
    await fx.call(
      wallet1,
      blsWallet,
      "setRecoveryHash",
      [recoveryHash],
      0,
      30_000_000,
    );

    const addressSignature = await signWalletAddress(
      fx,
      wallet1.address,
      wallet2.privateKey,
    );

    const recoveryTxn = await fx.verificationGateway
      .connect(recoverySigner)
      .recoverWallet(addressSignature, hash1, salt, wallet2.PublicKey());
    await recoveryTxn.wait();

    const [
      wallet1PubkeyHash,
      wallet2PubkeyHash,
      wallet1Nonce,
      wallet2Nonce,
      publicKey,
    ] = await Promise.all([
      vg.hashFromWallet(wallet1.address),
      vg.hashFromWallet(wallet2.address),
      wallet1.Nonce(),
      wallet2.Nonce(),
      getPublicKeyFromHash(vg, hash2),
    ]);
    expect(wallet1PubkeyHash).to.eql(hash2);
    expect(wallet2PubkeyHash).to.eql(hash2);
    expect(wallet1Nonce.toNumber()).to.eql(wallet2Nonce.toNumber());
    expect(publicKey).to.deep.equal(wallet2.PublicKey());

    // Attempt to run a bundle from wallet 2 through wallet 1
    // Signature verification should fail as addresses differ
    const invalidBundle = wallet2.sign({
      nonce: await wallet2.Nonce(),
      gas: 30_000_000,
      actions: [],
    });
    await expect(
      fx.verificationGateway.processBundle(invalidBundle),
    ).to.be.rejectedWith("VG: Sig not verified");
  });
});
