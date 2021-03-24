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

let BLSDemux: ContractFactory;
let blsDemux: Contract;

let testToken: Contract;
const initialSupply = ethers.utils.parseUnits("1000000")
const ACCOUNTS_LENGTH = 5;
const userStartAmount = initialSupply.div(ACCOUNTS_LENGTH);

async function init() {
  signers = (await ethers.getSigners()).slice(0, ACCOUNTS_LENGTH);
  addresses = await Promise.all(signers.map(acc => acc.getAddress()));

  blsSignerFactory = await BlsSignerFactory.new();
  blsSigners = addresses.map( add => blsSignerFactory.getSigner(DOMAIN, add) );

  // setup erc20 token
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  testToken = await MockERC20.deploy("AnyToken","TOK", initialSupply);
  await testToken.deployed();
  console.log(`baseToken: ${testToken.address}, main acc: ${addresses[0]}`);


  // deploy bls wallet with token address
  BLSDemux = await ethers.getContractFactory("BLSWalletDemux");
  blsDemux = await BLSDemux.deploy(); 
  await blsDemux.deployed();
  console.log(`blsDemux: ${blsDemux.address}`);
  
  // split supply amongst addresses, and approve transfer from wallet
  for (let i = 0; i<signers.length; i++) {
    console.log(`Transfer: ${i+1}/${signers.length}`);
    // first account as aggregator, and holds token supply
    await testToken.connect(signers[0]).transfer(addresses[i], userStartAmount);
  }
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

describe.only('BLSDemux', async function () {
  
  beforeEach(init);

  it.only('should register new wallet', async function () {
    let blsSigner: BlsSignerInterface = blsSigners[0];

    let ProxyInterface: Interface = new Interface(
      [Fragment.fromString("function walletCrossCheck(bytes32)")]
    );
    let blsPubKeyHash = keccak256(utils.solidityPack(
      ["uint256[4]"],
      [blsSigner.pubkey]
    ))
    let encodedFunction = ProxyInterface.encodeFunctionData(
      "walletCrossCheck",
      [blsPubKeyHash]
    );
    console.log(`ts: encodedFunction: ${encodedFunction}`);
    let encodedFunctionHash = utils.solidityKeccak256(
      ["bytes"],
      [encodedFunction]
    );
    let dataToSign = utils.solidityPack(
      ["address","bytes32"],
      [blsDemux.address.toString(), encodedFunctionHash]
    );

    let signature = blsSigner.sign(dataToSign);

    await blsDemux.blsCallCreate(
      signature,
      blsDemux.address,
      encodedFunction.substring(0,10),
      '0x'+encodedFunction.substr(10),
      blsSigner.pubkey
    );

    let walletAddress = await blsDemux.walletFromHash(blsPubKeyHash);

    const BLSWalletProxy = await ethers.getContractFactory("BLSWalletProxy");
    let blsWalletProxy = BLSWalletProxy.attach(walletAddress);
    expect(await blsWalletProxy.publicKeyHash()).to.equal(blsPubKeyHash);
  });

//   it('should set bls public key on deposit', async function () {
//     const INDEX = 1;
//     await blsDemux.connect(signers[INDEX]).deposit(blsWrapper.pubKeyForIndex(INDEX), userStartAmount);
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

//   it("should process multiple transfers", async function() {
//     await depositToWallet(signers);
//     const testTxs: BLSWrapper = createTestTxs();
    
    
//     let recipients = [];
//     let amounts = [];
//     const n = addresses.length;
//     for (let i=0; i<n; i++) {
//       const params = testTxs.paramSets[i];
//       recipients.push(params[0]);
//       amounts.push(params[1]);
//     }

//     let mcl = blsWrapper.getMCL();
//     const aggSignature = mcl.g1ToHex(mcl.aggregateRaw(testTxs.signatures));
//     let tx = await blsWallet.transferBatch(
//       aggSignature,
//       addresses,
//       testTxs.messages,
//       recipients,
//       amounts
//     );
//     await tx.wait();

//     expect(await blsWallet.balanceOf(addresses[0])).to.equal(0);
//     expect(await blsWallet.balanceOf(addresses[n-1])).to.equal(userStartAmount.mul(n));
//   });

  // TODO: test multiple txs from same address

});
