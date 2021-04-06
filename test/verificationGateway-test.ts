import { expect, assert } from "chai";

import { network, ethers as hhEthers, l2ethers } from "hardhat";

let ethers:typeof hhEthers | typeof l2ethers;
ethers = hhEthers;
if (network.name == "optimism") {
  ethers = l2ethers;
}

import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";
const utils = ethers.utils;

import * as mcl from "../server/src/lib/hubble-bls/src/mcl";

import { BlsSignerFactory, BlsSignerInterface } from "../server/src/lib/hubble-bls/src/signer";
import { keccak256, arrayify, Interface, Fragment, ParamType } from "ethers/lib/utils";

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

const zeroBLSPubKey = [0, 0, 0, 0].map(BigNumber.from);


let signers: Signer[];
let addresses: string[];

let blsSignerFactory: BlsSignerFactory;
let blsSigners: BlsSignerInterface[];

let VerificationGateway: ContractFactory;
let verificationGateway: Contract;

let testToken: Contract;
const initialSupply = ethers.utils.parseUnits("1000000")
const ACCOUNTS_LENGTH = 5;
const userStartAmount = initialSupply.div(ACCOUNTS_LENGTH);

async function init() {
  signers = (await ethers.getSigners()).slice(0, ACCOUNTS_LENGTH);
  addresses = await Promise.all(signers.map(acc => acc.getAddress()));

  blsSignerFactory = await BlsSignerFactory.new();
  blsSigners = addresses.map( add => blsSignerFactory.getSigner(DOMAIN, add) );

  // deploy Verification Gateway
  VerificationGateway = await ethers.getContractFactory("VerificationGateway");
  verificationGateway = await VerificationGateway.deploy(); 
  await verificationGateway.deployed();
  console.log(`verificationGateway: ${verificationGateway.address}`);
  
}

// async function depositToWallet(signers:Signer[]) {
//   const n = signers.length;

//   for (let i=0; i<n; i++) {
//     await testToken.connect(signers[i]).deposit(blsWrapper.pubKeyForIndex(i), userStartAmount);
//   }
// }

/**
 * Signs bls token transfers from each address to the last.
 * The last account should hold all tokens (minus a tiny portion from rounding).
 */
function createTestTxs() {
  const n = addresses.length;

//   for (let i = 0; i < n; i++) {
//       const recipient = addresses[n-1];
//       const amount = userStartAmount.toString();
//       blsWrapper.addTx([recipient, amount], i);
//   }
//   return blsWrapper;
}

function blsKeyHash(blsSigner: BlsSignerInterface) {
  return keccak256(utils.solidityPack(
    ["uint256[4]"],
    [blsSigner.pubkey]
  ));
}

function dataPayload(contractAddress: any, encodedFunction: string) {
  let encodedFunctionHash = utils.solidityKeccak256(
    ["bytes"],
    [encodedFunction]
  );
  return utils.solidityPack(
    ["address","bytes32"],
    [contractAddress.toString(), encodedFunctionHash]
  ); 
}

async function gatewayCall(
  contractAddress,
  encodedFunction,
  blsSigner
) {
  let dataToSign = dataPayload(
    contractAddress,
    encodedFunction
  );
  let signature = blsSigner.sign(dataToSign);

  // can be called by any ecdsa wallet
  await verificationGateway.blsCall(
    signature,
    contractAddress,
    encodedFunction.substring(0,10),
    '0x'+encodedFunction.substr(10),
    blsKeyHash(blsSigner)
  );
}

async function createBLSWallet(blsSigner: BlsSignerInterface): Promise<any> {

  const blsPubKeyHash = blsKeyHash(blsSigner);

  let encodedFunction = VerificationGateway.interface.encodeFunctionData(
    "walletCrossCheck",
    [blsPubKeyHash]
  );

  let dataToSign = dataPayload(
    verificationGateway.address,
    encodedFunction
  );

  let signature = blsSigner.sign(dataToSign);

  // can be called by any ecdsa wallet
  await verificationGateway.blsCallCreate(
    signature,
    verificationGateway.address,
    encodedFunction.substring(0,10),
    '0x'+encodedFunction.substr(10),
    blsSigner.pubkey
  );

  return await verificationGateway.walletFromHash(blsPubKeyHash);
}

async function transferFrom(
  sender: BlsSignerInterface,
  recipient: string,
  amount: BigNumber
) {
  let encodedFunction = testToken.interface.encodeFunctionData(
    "transfer",
    [recipient, amount.toString()]
  );
  gatewayCall(testToken.address, encodedFunction, sender);
}

describe.only('VerificationGateway', async function () {
  
  beforeEach(init);

  it('should register new wallet', async function () {
    let blsSigner = blsSigners[0];  
    let walletAddress = await createBLSWallet(blsSigner);

    const BLSWalletProxy = await ethers.getContractFactory("BLSWalletProxy");
    let blsWalletProxy = BLSWalletProxy.attach(walletAddress);
    expect(await blsWalletProxy.publicKeyHash())
      .to.equal(blsKeyHash(blsSigner));
  });

//   it('should set bls public key on deposit', async function () {
//     const INDEX = 1;
//     await verificationGateway.connect(signers[INDEX]).deposit(blsWrapper.pubKeyForIndex(INDEX), userStartAmount);
//     let hexArray = blsWrapper.pubKeyForIndex(INDEX);
//     expect(await blsWallet.blsPubKeyOf(addresses[INDEX])).to.deep.equal(hexArray.map(n => BigNumber.from(n)));
//   });

//   it('should withdraw full balance from token to bls wallet', async function () {
//     await blsWallet.connect(signers[1]).withdraw();
//     expect(await blsWallet.balanceOf(addresses[1])).to.equal(0);
//   });

//   it('should reset bls public key on withdraw', async function () {
//     await blsWallet.connect(signers[1]).withdraw();
//     expect(await blsWallet.blsPubKeyOf(addresses[1])).to.eql(zeroBLSPubKey);
//   });

//     //TODO
//   // it("should process single", async function() {
//   //   const INDEX = 1;
//   //   await blsWallet.connect(signers[INDEX]).deposit(mcl.g2ToHex(keyPairs[INDEX].pubkey), userStartAmount);
//   //   const account1Balance = await blsWallet.balanceOf(addresses[INDEX]);

//   // });

  it("should process individual transfers", async function() {
    // const testTxs: BLSWrapper = createTestTxs();
    let blsWalletAddresses = await Promise.all(blsSigners.map( s => createBLSWallet(s)));


    // setup erc20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    testToken = await MockERC20.deploy("AnyToken","TOK", initialSupply);
    await testToken.deployed();

    // split supply amongst bls wallet addresses
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      // first account as aggregator, and holds token supply
      await testToken.connect(signers[0]).transfer(
        blsWalletAddresses[i],
        userStartAmount
      );
    }

    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(userStartAmount);
    }

    //bls transfer all wallet balances to first wallet
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      await transferFrom(
        blsSigners[i],
        blsWalletAddresses[0],
        userStartAmount
      );
    }

    let totalAmount = userStartAmount.mul(blsWalletAddresses.length);
    for (let i = 0; i<blsWalletAddresses.length; i++) {
      let walletBalance = await testToken.balanceOf(blsWalletAddresses[i]);
      expect(walletBalance).to.equal(i==0?totalAmount:0);
    }
  });

  // it("should process multiple transfers", async function() {
  //   let recipients = [];
  //   let amounts = [];
  //   const n = addresses.length;
  //   for (let i=0; i<n; i++) {
  //     const params = testTxs.paramSets[i];
  //     recipients.push(params[0]);
  //     amounts.push(params[1]);
  //   }

  //   let mcl = blsWrapper.getMCL();
  //   const aggSignature = mcl.g1ToHex(mcl.aggregateRaw(testTxs.signatures));
  //   let tx = await blsWallet.transferBatch(
  //     aggSignature,
  //     addresses,
  //     testTxs.messages,
  //     recipients,
  //     amounts
  //   );
  //   await tx.wait();

  //   expect(await blsWallet.balanceOf(addresses[0])).to.equal(0);
  //   expect(await blsWallet.balanceOf(addresses[n-1])).to.equal(userStartAmount.mul(n));
  // });

  // TODO: test multiple txs from same address

});
