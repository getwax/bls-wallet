import { expect } from "chai";
import expectRevert from "../shared/helpers/expectRevert";

import { ethers, network } from "hardhat";
const utils = ethers.utils;

import Fixture, { FullTxData } from "../shared/helpers/Fixture";
import TokenHelper from "../shared/helpers/TokenHelper";
import dataPayload from "../shared/helpers/dataPayload";

import { aggregate } from "../shared/lib/hubble-bls/src/signer";
import { BigNumber } from "ethers";
import blsKeyHash from "../shared/helpers/blsKeyHash";
import blsSignFunction from "../shared/helpers/blsSignFunction";
import { parseEther } from "@ethersproject/units";
import deployAndRunPrecompileCostEstimator from "../shared/helpers/deployAndRunPrecompileCostEstimator";
import getDeployedAddresses from "../shared/helpers/getDeployedAddresses";
import { defaultDeployerAddress } from "../shared/helpers/deployDeployer";


describe('WalletActions', async function () {
  if (`${process.env.DEPLOYER_DEPLOYMENT}` === "true") {
    console.log("Skipping non-deployer tests.");
    return;
  }

  this.beforeAll(async function () {
    // deploy the deployer contract for the transient hardhat network
    if (network.name === "hardhat") {
      // fund deployer wallet address
      let fundedSigner = (await ethers.getSigners())[0];
      await (await fundedSigner.sendTransaction({
        to: defaultDeployerAddress(),
        value: utils.parseEther("1")
      })).wait();

      // deploy the precompile contract (via deployer)
      console.log("PCE:", await deployAndRunPrecompileCostEstimator());
    }
  });

  let fx: Fixture;
  let th: TokenHelper;
  beforeEach(async function() {
    if (network.name === "rinkarby") {
      let config = getDeployedAddresses(network.name);

      fx = await Fixture.create(
        Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH,
        false,
        config.blsLibAddress,
        config.vgAddress,
        config.expanderAddress
      );
    }
    else {
      fx = await Fixture.create();
    }
  });

  it('should register new wallet', async function () {
    let blsSigner = fx.blsSigners[0];  
    let walletAddress = await fx.createBLSWallet(blsSigner);

    const BLSWallet = await ethers.getContractFactory("BLSWallet");  
    
    let calculatedAddress = ethers.utils.getCreate2Address(
      fx.verificationGateway.address,
      blsKeyHash(blsSigner),
      ethers.utils.solidityKeccak256(
        ["bytes"],
        [BLSWallet.bytecode]
      )
    );
    expect(calculatedAddress).to.equal(walletAddress);

    let blsWallet = fx.BLSWallet.attach(walletAddress);
    
    await Promise.all(blsSigner.pubkey.map(async (keyPart, i) => 
      expect(await blsWallet.publicKey(i))
    .to.equal(keyPart)));

  });

  it('should receive ETH', async function() {
    let blsSigner = fx.blsSigners[0];  
    let walletAddress = await fx.createBLSWallet(blsSigner);

    let walletBalanceBefore = await fx.provider.getBalance(walletAddress);

    let ethToTransfer = utils.parseEther("0.0001");

    await fx.signers[0].sendTransaction({
      to: walletAddress,
      value: ethToTransfer
    });

    let walletBalanceAfter = await fx.provider.getBalance(walletAddress);
    expect(walletBalanceAfter.sub(walletBalanceBefore)).to.equal(ethToTransfer);
  });

  it('should send ETH (empty call)', async function() {
    // send money to sender bls wallet
    let senderBlsSigner = fx.blsSigners[0];
    let receiverBlsSigner = fx.blsSigners[1];
    let senderAddress = await fx.createBLSWallet(senderBlsSigner);
    let receiverAddress:string = await fx.createBLSWallet(receiverBlsSigner);
    let ethToTransfer = utils.parseEther("0.0001");
    await fx.signers[0].sendTransaction({
      to: senderAddress,
      value: ethToTransfer
    });

    let senderBalanceBefore = await fx.provider.getBalance(senderAddress);
    let receiverBalanceBefore = await fx.provider.getBalance(receiverAddress);

    let ethSend_FullTxData:FullTxData = {
      blsSigner: senderBlsSigner,
      chainId: fx.chainId,
      nonce: 1,
      ethValue: ethToTransfer,
      contract: receiverAddress,
      functionName: "",
      params: []
      // contract: fx.verificationGateway,
      // functionName: "walletCrossCheck",
      // params: [blsKeyHash(senderBlsSigner)]
    };

    await fx.gatewayCallFull(ethSend_FullTxData);

    let senderBalanceAfter = await fx.provider.getBalance(senderAddress);
    let receiverBalanceAfter = await fx.provider.getBalance(receiverAddress);

    expect(senderBalanceBefore.sub(senderBalanceAfter)).to.equal(ethToTransfer);
    expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.equal(ethToTransfer);
  })

  it('should send ETH with function call', async function() {
    // send money to sender bls wallet
    let senderBlsSigner = fx.blsSigners[0];
    let senderAddress = await fx.createBLSWallet(senderBlsSigner);
    let ethToTransfer = utils.parseEther("0.001");
    await fx.signers[0].sendTransaction({
      to: senderAddress,
      value: ethToTransfer
    });

    const MockAuction = await ethers.getContractFactory("MockAuction");
    let mockAuction = await MockAuction.deploy();
    await mockAuction.deployed();

    expect(await fx.provider.getBalance(senderAddress)).to.equal(ethToTransfer);
    expect(await fx.provider.getBalance(mockAuction.address)).to.equal(0);

    await fx.gatewayCallFull({
      blsSigner: senderBlsSigner,
      chainId: fx.chainId,
      nonce: 1,
      ethValue: ethToTransfer,
      contract: mockAuction,
      functionName: "buyItNow",
      params: []
    })

    expect(await fx.provider.getBalance(senderAddress)).to.equal(0);
    expect(await fx.provider.getBalance(mockAuction.address)).to.equal(ethToTransfer);
  })

  it('should check signature', async function () {
    let blsSigner = fx.blsSigners[0];
    let blsWallet = fx.BLSWallet.attach(await fx.createBLSWallet(blsSigner));
    let walletNonce = ((await blsWallet.nonce()) as BigNumber).toNumber();

    let [txData, signature] = blsSignFunction({
      blsSigner: blsSigner,
      chainId: fx.chainId,
      nonce: walletNonce,
      ethValue: BigNumber.from(0),
      contract: fx.verificationGateway,
      functionName: "walletCrossCheck",
      params: [blsKeyHash(blsSigner)]    
    });

    await fx.verificationGateway.callStatic.verifySignatures(
      [blsSigner.pubkey],
      signature,
      [txData]
    );

    txData.ethValue = parseEther("1");
    await expectRevert(
      fx.verificationGateway.callStatic.verifySignatures(
        [blsSigner.pubkey],
        signature,
        [txData]
      )
    );
  });

  it("should process individual calls", async function() {
    th = new TokenHelper(fx);
    let blsWalletAddresses = await th.walletTokenSetup();

    // check each wallet has start amount
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await th.testToken!.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(th.userStartAmount);
    }
    // bls transfer each wallet's balance to first wallet
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      await th.transferFrom(
        await fx.BLSWallet.attach(blsWalletAddresses[i]).nonce(),
        BigNumber.from(0),
        fx.blsSigners[i],
        blsWalletAddresses[0],
        th.userStartAmount
      );
    }

    // check first wallet full and others empty
    let totalAmount = th.userStartAmount.mul(blsWalletAddresses.length);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await th.testToken!.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(i==0?totalAmount:0);
    }
  });

  it("should airdrop", async function() {
    th = new TokenHelper(fx);

    let blsWalletAddresses = await fx.createBLSWallets();
    let testToken = await TokenHelper.deployTestToken();

    // send all to first address
    let totalAmount = th.userStartAmount.mul(blsWalletAddresses.length);
    await(await testToken.connect(fx.signers[0]).transfer(
      blsWalletAddresses[0],
      totalAmount
    )).wait();

    let signatures: any[] = new Array(blsWalletAddresses.length);
    let encodedParams: string[] = new Array(blsWalletAddresses.length);
    let startNonce = await fx.BLSWallet.attach(blsWalletAddresses[0]).nonce();
    let nonce = startNonce.toNumber();
    let reward = BigNumber.from(0);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      // encode transfer of start amount to each wallet
      let encodedFunction = testToken.interface.encodeFunctionData(
        "transfer",
        [blsWalletAddresses[i], th.userStartAmount.toString()]
      );
      encodedParams[i] = '0x'+encodedFunction.substr(10);

      let dataToSign = dataPayload(
        fx.chainId,
        nonce++,
        BigNumber.from(0),
        testToken.address,
        encodedFunction
      );
      signatures[i] = fx.blsSigners[0].sign(dataToSign);
    }

    let aggSignature = aggregate(signatures);

    await(await fx.blsExpander.blsCallMultiSameCallerContractFunction(
      fx.blsSigners[0].pubkey,
      startNonce,
      aggSignature,
      ethers.constants.AddressZero,
      Array(signatures.length).fill(0),
      testToken.address,
      testToken.interface.getSighash("transfer"),
      encodedParams
    )).wait();

    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(th.userStartAmount);
    }

  });

  it('should check token reward', async function() {
    // Construct 2 transactions:
    //  - one sending ETH to between wallet 1 and wallet 2 
    //  - one sending tokens from rewarderAddress to rewardRecipient
    // Use blsCallMultiCheckRewardIncrease function to check reward amount

    // prepare bls signers, wallets, eth and token balances
    let rewarderBlsSigner = fx.blsSigners[0];
    let rewarderAddress = await fx.createBLSWallet(rewarderBlsSigner);
    let wallet1Address:string = await fx.createBLSWallet(fx.blsSigners[1]);
    let wallet2Address:string = await fx.createBLSWallet(fx.blsSigners[2]);
    let ethToTransfer = utils.parseEther("0.0001");
    await fx.signers[0].sendTransaction({
      to: wallet1Address,
      value: ethToTransfer
    });
    th = new TokenHelper(fx);
    let testToken = await TokenHelper.deployTestToken();
    await(await testToken.connect(fx.signers[0]).transfer(
      rewarderAddress,
      th.userStartAmount
    )).wait();

    // prepare and sign eth transfer tx (from wallet 1 to 2)
    let [txData1, sig1] = blsSignFunction({
      blsSigner: fx.blsSigners[1],
      chainId: fx.chainId,
      nonce: 1,
      ethValue: ethToTransfer,
      contract: wallet2Address,
      functionName: "",
      params: []
    });

    // prepare and sign token transfer to origin tx (reward)
    let rewardTokenAddress = testToken.address;
    let rewardAmountRequired = th.userStartAmount.div(4); // arbitrary reward amount
    let rewardAmountToSend = rewardAmountRequired.mul(2); // send double reward    

    let blsWallet = fx.BLSWallet.attach(rewarderAddress);
    let functionName = "transferToOrigin";
    let params = [rewardAmountToSend, testToken.address];
    let [txData2, sig2] = blsSignFunction({
      blsSigner: rewarderBlsSigner,
      chainId: fx.chainId,
      nonce: 1,
      ethValue: BigNumber.from(0),
      contract: blsWallet,
      functionName: functionName, 
      params: params
    });

    // shouldn't be able to directly call transferToOrigin
    expectRevert(
      blsWallet.transferToOrigin(rewardAmountToSend, testToken.address),
      "BLSWallet: only callable from this"
    );

    let aggSignature = aggregate([sig1, sig2]);

    // callStatic to return correct increase
    let rewardIncrease = await fx.blsExpander.callStatic.blsCallMultiCheckRewardIncrease(
      rewardTokenAddress,
      rewardAmountRequired,
      [fx.blsSigners[1].pubkey, rewarderBlsSigner.pubkey],
      aggSignature,
      [txData1, txData2]
    );
    expect(rewardIncrease).to.equal(rewardAmountToSend);

    // exception when required more than rewarded
    await expectRevert(fx.blsExpander.callStatic.blsCallMultiCheckRewardIncrease(
      rewardTokenAddress,
      rewardAmountToSend.add(1), //require more than amount sent
      [fx.blsSigners[1].pubkey, rewarderBlsSigner.pubkey],
      aggSignature,
      [txData1, txData2]
    ));

    // rewardRecipient balance increased after actioning transfer
    let balanceBefore = await testToken.balanceOf(fx.addresses[0]);
    await (await fx.blsExpander.blsCallMultiCheckRewardIncrease(
      rewardTokenAddress,
      rewardAmountRequired,
      [fx.blsSigners[1].pubkey, rewarderBlsSigner.pubkey],
      aggSignature,
      [txData1, txData2]
    )).wait();
    let balanceAfter = await testToken.balanceOf(fx.addresses[0]);
    expect(balanceAfter.sub(balanceBefore)).to.equal(rewardAmountToSend);
  })

});

