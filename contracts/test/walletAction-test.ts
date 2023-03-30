import { expect } from "chai";

import { ethers } from "hardhat";

import Fixture from "../shared/helpers/Fixture";
import TokenHelper from "../shared/helpers/TokenHelper";

import { BigNumber, ContractReceipt } from "ethers";
import { parseEther, solidityPack } from "ethers/lib/utils";
import { getOperationResults } from "../clients/src";

describe("WalletActions", async function () {
  if (`${process.env.DEPLOYER_DEPLOYMENT}` === "true") {
    console.log("Skipping non-deployer tests.");
    return;
  }

  let fx: Fixture;
  beforeEach(async function () {
    fx = await Fixture.getSingleton();
  });

  it("should register new wallet", async function () {
    const wallet = await fx.createBLSWallet();
    expect(fx.verificationGateway.address).to.equal(
      fx.verificationGateway.address,
    );

    const BLSWallet = await ethers.getContractFactory("BLSWallet");
    const TransparentUpgradeableProxy = await ethers.getContractFactory(
      "TransparentUpgradeableProxy",
    );
    const proxyAdminAddress = await fx.verificationGateway.walletProxyAdmin();
    const blsWalletLogicAddress = await fx.verificationGateway.blsWalletLogic();

    const initFunctionParams = BLSWallet.interface.encodeFunctionData(
      "initialize",
      [fx.verificationGateway.address],
    );

    const calculatedAddress = ethers.utils.getCreate2Address(
      fx.verificationGateway.address,
      wallet.blsWalletSigner.getPublicKeyHash(),
      ethers.utils.solidityKeccak256(
        ["bytes", "bytes"],
        [
          TransparentUpgradeableProxy.bytecode,
          ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "bytes"],
            [blsWalletLogicAddress, proxyAdminAddress, initFunctionParams],
          ),
        ],
      ),
    );

    // TODO: Better to check against address calculated by VerificationGateway
    expect(calculatedAddress).to.equal(wallet.address);
  });

  it("should receive ETH", async function () {
    const wallet = await fx.createBLSWallet();

    const walletBalanceBefore = await fx.provider.getBalance(wallet.address);

    const ethToTransfer = parseEther("0.0001");

    await fx.signers[0].sendTransaction({
      to: wallet.address,
      value: ethToTransfer,
    });

    const walletBalanceAfter = await fx.provider.getBalance(wallet.address);
    expect(walletBalanceAfter.sub(walletBalanceBefore)).to.equal(ethToTransfer);
  });

  it("should send ETH", async function () {
    // send money to sender bls wallet
    const sendWallet = await fx.createBLSWallet();
    const recvWallet = await fx.createBLSWallet();
    const ethToTransfer = parseEther("0.0001");
    await fx.signers[0].sendTransaction({
      to: sendWallet.address,
      value: ethToTransfer,
    });

    const senderBalanceBefore = await fx.provider.getBalance(
      sendWallet.address,
    );
    const receiverBalanceBefore = await fx.provider.getBalance(
      recvWallet.address,
    );

    const tx = await sendWallet.signWithGasEstimate({
      nonce: await sendWallet.Nonce(),
      actions: [
        {
          ethValue: ethToTransfer,
          contractAddress: recvWallet.walletContract.address,
          encodedFunction: "0x",
        },
      ],
    });

    await fx.verificationGateway.processBundle(
      fx.blsWalletSigner.aggregate([tx]),
    );

    const senderBalanceAfter = await fx.provider.getBalance(sendWallet.address);
    const receiverBalanceAfter = await fx.provider.getBalance(
      recvWallet.address,
    );

    expect(senderBalanceBefore.sub(senderBalanceAfter)).to.equal(ethToTransfer);
    expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.equal(
      ethToTransfer,
    );
  });

  it("should send ETH with function call", async function () {
    // send money to sender bls wallet
    const sendWallet = await fx.createBLSWallet();
    const ethToTransfer = parseEther("0.001");
    await fx.signers[0].sendTransaction({
      to: sendWallet.address,
      value: ethToTransfer,
    });

    const MockAuction = await ethers.getContractFactory("MockAuction");
    const mockAuction = await MockAuction.deploy();
    await mockAuction.deployed();

    await expect(
      fx.provider.getBalance(sendWallet.address),
    ).to.eventually.equal(ethToTransfer);
    await expect(
      fx.provider.getBalance(mockAuction.address),
    ).to.eventually.equal(0);

    await (
      await fx.verificationGateway.processBundle(
        await sendWallet.signWithGasEstimate({
          nonce: 0,
          actions: [
            {
              ethValue: ethToTransfer,
              contractAddress: mockAuction.address,
              encodedFunction:
                mockAuction.interface.encodeFunctionData("buyItNow"),
            },
          ],
        }),
      )
    ).wait();

    await expect(
      fx.provider.getBalance(sendWallet.address),
    ).to.eventually.equal(0);
    await expect(
      fx.provider.getBalance(mockAuction.address),
    ).to.eventually.equal(ethToTransfer);
  });

  it("should check signature", async function () {
    const wallet = await fx.createBLSWallet();

    const tx = await wallet.signWithGasEstimate({
      nonce: await wallet.Nonce(),
      actions: [
        {
          ethValue: BigNumber.from(0),
          contractAddress: fx.verificationGateway.address,
          encodedFunction: fx.verificationGateway.interface.encodeFunctionData(
            "walletFromHash",
            [fx.blsWalletSigner.getPublicKeyHash()],
          ),
        },
      ],
    });

    await fx.verificationGateway.callStatic.verify(tx);

    tx.operations[0].actions[0].ethValue = parseEther("1");
    await expect(fx.verificationGateway.callStatic.verify(tx)).to.be.rejected;
  });

  it("(ERC-1271) should verify message", async function () {
    const wallet = await fx.createBLSWallet();
    const blsWallet = await ethers.getContractAt("BLSWallet", wallet.address);

    const hashedMessage = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("I'm a message"),
    );

    const signature = wallet.signMessage(hashedMessage);
    const concatenatedSignature =
      ethers.utils.hexlify(signature[0]) +
      ethers.utils.hexlify(signature[1]).substring(2);
    const signatureBytes = ethers.utils.arrayify(concatenatedSignature);

    const expectedBytes4MagicValue = ethers.utils
      .solidityKeccak256(["string"], ["isValidSignature(bytes32,bytes)"])
      .substring(0, 10);

    // initial call needed to ensure isValidSignature is successful
    await fx.call(wallet, blsWallet, "nonce", [], 0, 30_000_000);

    const magicValue = await blsWallet.isValidSignature(
      hashedMessage,
      signatureBytes,
    );

    expect(magicValue).to.equal(expectedBytes4MagicValue);
  });

  it("(ERC-1271) should fail to verify message when the wrong message is signed", async function () {
    const wallet = await fx.createBLSWallet();
    const blsWallet = await ethers.getContractAt("BLSWallet", wallet.address);

    const hashedMessage = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("I'm a message"),
    );

    const signatureWithWrongMessage = wallet.signMessage("0x1234");
    const concatenatedSignature =
      ethers.utils.hexlify(signatureWithWrongMessage[0]) +
      ethers.utils.hexlify(signatureWithWrongMessage[1]).substring(2);
    const signatureBytes = ethers.utils.arrayify(concatenatedSignature);

    const expectedMagicValue = "0xffffffff";

    // initial call needed to ensure isValidSignature is successful
    await fx.call(wallet, blsWallet, "nonce", [], 0, 30_000_000);

    const magicValue = await blsWallet.isValidSignature(
      hashedMessage,
      signatureBytes,
    );

    expect(magicValue).to.equal(expectedMagicValue);
  });

  it("(ERC-1271) should fail to verify message signed by another wallet", async function () {
    const wallet = await fx.createBLSWallet();
    const blsWallet = await ethers.getContractAt("BLSWallet", wallet.address);

    const imposterWallet = await fx.createBLSWallet();

    const hashedMessage = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("I'm a message"),
    );

    const signature = imposterWallet.signMessage(hashedMessage);
    const concatenatedSignature =
      ethers.utils.hexlify(signature[0]) +
      ethers.utils.hexlify(signature[1]).substring(2);
    const signatureBytes = ethers.utils.arrayify(concatenatedSignature);

    const expectedMagicValue = "0xffffffff";

    // initial call needed to ensure isValidSignature is successful
    await fx.call(wallet, blsWallet, "nonce", [], 0, 30_000_000);

    const magicValue = await blsWallet.isValidSignature(
      hashedMessage,
      signatureBytes,
    );

    expect(magicValue).to.equal(expectedMagicValue);
  });

  it("(ERC-1271) should fail to verify message when signature is not 64 bytes long", async function () {
    const wallet = await fx.createBLSWallet();
    const blsWallet = await ethers.getContractAt("BLSWallet", wallet.address);

    const hashedMessage = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("I'm a message"),
    );

    const signature = wallet.signMessage(hashedMessage);
    const longConcatenatedSignature =
      ethers.utils.hexlify(signature[0]) +
      ethers.utils.hexlify(signature[1]).substring(2) +
      ethers.utils.hexlify("0x12").substring(2);

    const shortSignature = ethers.utils.arrayify("0x00");
    const longSignature = ethers.utils.arrayify(longConcatenatedSignature);

    // initial call needed to ensure isValidSignature is successful
    await fx.call(wallet, blsWallet, "nonce", [], 0, 30_000_000);

    await expect(
      blsWallet.isValidSignature(hashedMessage, shortSignature),
    ).to.be.rejectedWith("VG: Sig bytes length must be 64");
    await expect(
      blsWallet.isValidSignature(hashedMessage, longSignature),
    ).to.be.rejectedWith("VG: Sig bytes length must be 64");
  });

  it("(ERC-1271) should fail to verify message when not called from BLS Wallet", async function () {
    const mockHashedMessage = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("I'm a message"),
    );
    const mockSignature = ethers.utils.arrayify("0x00");

    await expect(
      fx.verificationGateway.isValidSignature(mockHashedMessage, mockSignature),
    ).to.be.rejectedWith("VG: not called from wallet");
  });

  it("should process individual calls", async function () {
    const th = new TokenHelper(fx, Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH);
    const wallets = await th.walletTokenSetup();

    // check each wallet has start amount
    for (let i = 0; i < wallets.length; i++) {
      const walletBalance = await th.testToken.balanceOf(wallets[i].address);
      expect(walletBalance).to.equal(th.userStartAmount);
    }
    // bls transfer each wallet's balance to first wallet
    for (let i = 0; i < wallets.length; i++) {
      await th.transferFrom(
        await wallets[i].Nonce(),
        wallets[i],
        wallets[0].address,
        th.userStartAmount,
      );
    }

    // check first wallet full and others empty
    const totalAmount = th.userStartAmount.mul(wallets.length);
    for (let i = 0; i < wallets.length; i++) {
      const walletBalance = await th.testToken.balanceOf(wallets[i].address);
      expect(walletBalance).to.equal(i === 0 ? totalAmount : 0);
    }
  });

  it("should allow other operations when one fails", async () => {
    const th = new TokenHelper(fx, Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH);
    const [sender1, sender2, recipient] = await th.walletTokenSetup();

    await (
      await fx.verificationGateway.processBundle(
        fx.blsWalletSigner.aggregate([
          await sender1.signWithGasEstimate({
            nonce: await sender1.Nonce(),
            actions: [
              {
                ethValue: 0,
                contractAddress: th.testToken.address,
                encodedFunction: th.testToken.interface.encodeFunctionData(
                  "transfer",
                  [
                    recipient.address,

                    // Should fail because it's more than the sender has
                    th.userStartAmount.add(1),
                  ],
                ),
              },
            ],
          }),
          await sender2.signWithGasEstimate({
            nonce: await sender2.Nonce(),
            actions: [
              {
                ethValue: 0,
                contractAddress: th.testToken.address,
                encodedFunction: th.testToken.interface.encodeFunctionData(
                  "transfer",
                  [
                    recipient.address,

                    // Should succeed (should not be affected by other operation
                    // in bundle)
                    th.userStartAmount,
                  ],
                ),
              },
            ],
          }),
        ]),
      )
    ).wait();

    const recipientBalance = await th.testToken.balanceOf(recipient.address);

    // Should have exactly double the starting amount by receiving all of
    // sender2's tokens.
    expect(recipientBalance.eq(th.userStartAmount.mul(2)));
  });

  it("should prevent other actions within an operation when one fails", async () => {
    const th = new TokenHelper(fx, Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH);
    const [sender, recipient] = await th.walletTokenSetup();

    const r: ContractReceipt = await (
      await fx.verificationGateway.processBundle(
        await sender.signWithGasEstimate({
          nonce: await sender.Nonce(),
          actions: [
            // Send tokens to recipient.
            {
              ethValue: 0,
              contractAddress: th.testToken.address,
              encodedFunction: th.testToken.interface.encodeFunctionData(
                "transfer",
                [recipient.address, th.userStartAmount],
              ),
            },

            // Try to send ourselves a lot of tokens from address zero, which
            // obviously shouldn't work.
            {
              ethValue: 0,
              contractAddress: th.testToken.address,
              encodedFunction: th.testToken.interface.encodeFunctionData(
                "transferFrom",
                [
                  ethers.constants.AddressZero,
                  sender.address,
                  ethers.constants.MaxUint256,
                ],
              ),
            },
          ],
        }),
      )
    ).wait();

    const opResults = getOperationResults(r);
    expect(opResults).to.have.lengthOf(1);
    expect(opResults[0].error.actionIndex.toNumber()).to.eql(1);
    expect(opResults[0].error.message).to.eql("ERC20: insufficient allowance");

    const recipientBalance = await th.testToken.balanceOf(recipient.address);

    // Should be unchanged because the operation that would have added tokens
    // also contained a transferFrom from the zero address.
    expect(recipientBalance.eq(th.userStartAmount));
  });

  it("should airdrop (multicall)", async function () {
    const walletCount = Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH;

    const th = new TokenHelper(fx, walletCount);

    const wallets = await fx.createBLSWallets(walletCount);
    const testToken = await TokenHelper.deployTestToken();

    // send all to first address
    const totalAmount = th.userStartAmount.mul(wallets.length);
    await (
      await testToken
        .connect(fx.signers[0])
        .transfer(wallets[0].address, totalAmount)
    ).wait();

    const nonce = await wallets[0].Nonce();

    const tx = await wallets[0].signWithGasEstimate({
      nonce,
      actions: wallets.map((recvWallet) => ({
        ethValue: BigNumber.from(0),
        contractAddress: testToken.address,
        encodedFunction: testToken.interface.encodeFunctionData("transfer", [
          recvWallet.address,
          th.userStartAmount.toString(),
        ]),
      })),
    });

    await (
      await fx.blsExpander.blsCallMultiSameCallerContractFunction(
        tx.senderPublicKeys[0],
        nonce,
        tx.operations[0].gas,
        tx.signature,
        testToken.address,
        testToken.interface.getSighash("transfer"),
        tx.operations[0].actions.map(
          (action) =>
            `0x${solidityPack(["bytes"], [action.encodedFunction]).slice(10)}`,
        ),
      )
    ).wait();

    for (let i = 0; i < wallets.length; i++) {
      const walletBalance = await testToken.balanceOf(wallets[i].address);
      expect(walletBalance).to.equal(th.userStartAmount);
    }
  });

  // TODO: update with approve and transfer actions to tx.origin
  // it('should check token reward', async function() {
  //   // Construct 2 transactions:
  //   //  - one sending ETH to between wallet 1 and wallet 2
  //   //  - one sending tokens from rewarderAddress to rewardRecipient
  //   // Use blsCallMultiCheckRewardIncrease function to check reward amount

  //   // prepare bls signers, wallets, eth and token balances
  //   const rewarder = await fx.createBLSWallet();
  //   const wallet1 = await fx.createBLSWallet();
  //   const wallet2 = await fx.createBLSWallet();

  //   let ethToTransfer = utils.parseEther("0.0001");
  //   await fx.signers[0].sendTransaction({
  //     to: wallet1.address,
  //     value: ethToTransfer
  //   });
  //   th = new TokenHelper(fx, Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH);
  //   let testToken = await TokenHelper.deployTestToken();
  //   await(await testToken.connect(fx.signers[0]).transfer(
  //     rewarder.address,
  //     th.userStartAmount
  //   )).wait();

  //   // prepare and sign eth transfer tx (from wallet 1 to 2)
  //   const tx1 = wallet1.sign({
  //     nonce: BigNumber.from(1),
  //     atomic: true,
  //     actions: [
  //       {
  //         ethValue: ethToTransfer,
  //         contractAddress: wallet2.walletContract.address,
  //         encodedFunction: "0x",
  //       },
  //     ],
  //   });

  //   // prepare and sign token transfer to origin tx (reward)
  //   let rewardTokenAddress = testToken.address;
  //   let rewardAmountRequired = th.userStartAmount.div(4); // arbitrary reward amount
  //   let rewardAmountToSend = rewardAmountRequired.mul(2); // send double reward

  //   const tx2 = rewarder.sign({
  //     nonce: BigNumber.from(1),
  //     atomic: true,
  //     actions: [
  //       {
  //         ethValue: BigNumber.from(0),
  //         contractAddress: fx.verificationGateway.contract.address,
  //         encodedFunction: fx.verificationGateway.contract.interface.encodeFunctionData(
  //           "transferToOrigin",
  //           [rewardAmountToSend, testToken.address],
  //         ),
  //       },
  //     ],
  //   });

  //   // shouldn't be able to directly call transferToOrigin
  //   expect(
  //     fx.verificationGateway.contract.transferToOrigin(rewardAmountToSend, testToken.address)
  //   ).to.be.rejected;

  //   const aggTx = fx.blsWalletSigner.aggregate([tx1, tx2]);

  //   // callStatic to return correct increase
  //   let rewardIncrease = await fx.blsExpander.callStatic.blsCallMultiCheckRewardIncrease(
  //     rewardTokenAddress,
  //     rewardAmountRequired,
  //     aggTx.subTransactions.map(tx => splitHex256(tx.publicKey)),
  //     splitHex256(aggTx.signature),
  //     aggTx.subTransactions.map(tx => ({
  //       nonce: tx.nonce,
  //       atomic: tx.atomic,
  //       actions: tx.actions,
  //     })),
  //   );
  //   expect(rewardIncrease).to.equal(rewardAmountToSend);

  //   // exception when required more than rewarded
  //   await expect(fx.blsExpander.callStatic.blsCallMultiCheckRewardIncrease(
  //     rewardTokenAddress,
  //     rewardAmountToSend.add(1), //require more than amount sent
  //     aggTx.subTransactions.map(tx => splitHex256(tx.publicKey)),
  //     splitHex256(aggTx.signature),
  //     aggTx.subTransactions.map(tx => ({
  //       nonce: tx.nonce,
  //       atomic: tx.atomic,
  //       actions: tx.actions,
  //     })),
  //   )).to.be.rejected;

  //   // rewardRecipient balance increased after actioning transfer
  //   let balanceBefore = await testToken.balanceOf(fx.addresses[0]);
  //   await (await fx.blsExpander.blsCallMultiCheckRewardIncrease(
  //     rewardTokenAddress,
  //     rewardAmountRequired,
  //     aggTx.subTransactions.map(tx => splitHex256(tx.publicKey)),
  //     splitHex256(aggTx.signature),
  //     aggTx.subTransactions.map(tx => ({
  //       nonce: tx.nonce,
  //       atomic: tx.atomic,
  //       actions: tx.actions,
  //     })),
  //   )).wait();
  //   let balanceAfter = await testToken.balanceOf(fx.addresses[0]);
  //   expect(balanceAfter.sub(balanceBefore)).to.equal(rewardAmountToSend);
  // })
});
