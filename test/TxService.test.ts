import { assertEquals } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("adds valid transaction", async (fx) => {
  const txService = await fx.createTxService();

  const blsSigner = await fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const tx = await fx.createTxData({
    blsSigner,
    contract: fx.walletService.erc20,
    method: "mint",
    args: [blsWallet.address, "3"],
    nonceOffset: 0,
  });

  assertEquals(await txService.txTable.count(), 0n);

  const failures = await txService.add(tx);
  assertEquals(failures, []);

  assertEquals(await txService.txTable.count(), 1n);
});

Fixture.test("rejects transaction with invalid signature", async (fx) => {
  const txService = await fx.createTxService();

  const blsSigner = await fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const tx = await fx.createTxData({
    blsSigner,
    contract: fx.walletService.erc20,
    method: "mint",
    args: [blsWallet.address, "3"],
    nonceOffset: 0,
  });

  // Make the signature invalid
  tx.signature = [
    "0x",
    tx.signature[2] === "0" ? "1" : "0",
    tx.signature.slice(3),
  ].join("");

  assertEquals(await txService.txTable.count(), 0n);

  const failures = await txService.add(tx);
  assertEquals(failures.map((f) => f.type), ["invalid-signature"]);

  // Transaction table remains empty
  assertEquals(await txService.txTable.count(), 0n);
});

Fixture.test("rejects transaction with nonce from the past", async (fx) => {
  const txService = await fx.createTxService();

  const blsSigner = await fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const tx = await fx.createTxData({
    blsSigner,
    contract: fx.walletService.erc20,
    method: "mint",
    args: [blsWallet.address, "3"],
    nonceOffset: -1,
  });

  // createTxData would have correctly set nonce 1 if we hadn't used offset -1.
  // (a transaction with nonce 0 occurs when creating the wallet)
  assertEquals(tx.nonce, 0);

  assertEquals(await txService.txTable.count(), 0n);

  const failures = await txService.add(tx);
  assertEquals(failures.map((f) => f.type), ["duplicate-nonce"]);

  // Transaction table remains empty
  assertEquals(await txService.txTable.count(), 0n);
});

Fixture.test(
  "rejects transaction with invalid signature and nonce from the past",
  async (fx) => {
    const txService = await fx.createTxService();

    const blsSigner = await fx.createBlsSigner();
    const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

    const tx = await fx.createTxData({
      blsSigner,
      contract: fx.walletService.erc20,
      method: "mint",
      args: [blsWallet.address, "3"],
      nonceOffset: -1,
    });

    // createTxData would have correctly set nonce 1 if we hadn't used offset -1.
    // (a transaction with nonce 0 occurs when creating the wallet)
    assertEquals(tx.nonce, 0);

    // Make the signature invalid
    tx.signature = [
      "0x",
      tx.signature[2] === "0" ? "1" : "0",
      tx.signature.slice(3),
    ].join("");

    assertEquals(await txService.txTable.count(), 0n);

    const failures = await txService.add(tx);

    assertEquals(
      failures.map((f) => f.type).sort(),
      ["duplicate-nonce", "invalid-signature"],
    );

    // Transaction table remains empty
    assertEquals(await txService.txTable.count(), 0n);
  },
);

Fixture.test("adds tx with future nonce to pendingTxs", async (fx) => {
  const txService = await fx.createTxService();

  const blsSigner = await fx.createBlsSigner();
  const blsWallet = await fx.getOrCreateBlsWallet(blsSigner);

  const tx = await fx.createTxData({
    blsSigner,
    contract: fx.walletService.erc20,
    method: "mint",
    args: [blsWallet.address, "3"],
    nonceOffset: 1,
  });

  assertEquals(await txService.txTable.count(), 0n);
  assertEquals(await txService.pendingTxTable.count(), 0n);

  const failures = await txService.add(tx);
  assertEquals(failures, []);

  assertEquals(await txService.txTable.count(), 0n);
  assertEquals(await txService.pendingTxTable.count(), 1n);
});
