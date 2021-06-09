
import { ethers, network } from "hardhat";

import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";
const utils = ethers.utils;

// import * as mcl from "../server/src/lib/hubble-bls/src/mcl";

import { BlsSignerFactory, BlsSignerInterface, aggregate } from "../lib/hubble-bls/src/signer";
import { keccak256, arrayify, Interface, Fragment, ParamType } from "ethers/lib/utils";

import { expectEvent, expectRevert } from "@openzeppelin/test-helpers";

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

const zeroBLSPubKey = [0, 0, 0, 0].map(BigNumber.from);
const zeroAddress = "0x0000000000000000000000000000000000000000";

export default class Fixture {
  
  static readonly ACCOUNTS_LENGTH = 5;

  private constructor(
    public chainId: number,

    public signers: Signer[],
    public addresses: string[],

    public blsSignerFactory: BlsSignerFactory,
    public blsSigners: BlsSignerInterface[],

    public VerificationGateway: ContractFactory,
    public verificationGateway: Contract,

    public BLSExpander: ContractFactory,
    public blsExpander: Contract,

    public BLSWallet: ContractFactory,
  ) {}

  /// @dev Contracts deployed by first ethers signer 
  static async create(initialized: boolean=true) {
    let chainId = (await ethers.provider.getNetwork()).chainId;
    console.log("ChainId from provider", chainId);

    let signers = (await ethers.getSigners()).slice(0, Fixture.ACCOUNTS_LENGTH);
    let addresses = await Promise.all(signers.map(acc => acc.getAddress())) as string[];
  
    let blsSignerFactory = await BlsSignerFactory.new();
    let blsSigners = addresses.map( add => blsSignerFactory.getSigner(DOMAIN, add) );
  
    // deploy Verification Gateway
    let VerificationGateway = await ethers.getContractFactory("VerificationGateway");
    let verificationGateway = await VerificationGateway.deploy();
    await verificationGateway.deployed();
    if (initialized) {
      await verificationGateway.initialize(zeroAddress);
    }
  
    let BLSExpander = await ethers.getContractFactory("BLSExpander");
    let blsExpander = await BLSExpander.deploy(); 
    await blsExpander.deployed();
    await blsExpander.initialize(verificationGateway.address);
    
    let BLSWallet = await ethers.getContractFactory("BLSWallet");
  
    return new Fixture(
      chainId,
      signers,
      addresses,
      blsSignerFactory,
      blsSigners,
      VerificationGateway,
      verificationGateway,
      BLSExpander,
      blsExpander,
      BLSWallet
    );
  }

  static blsKeyHash(blsSigner: BlsSignerInterface) {
    return keccak256(utils.solidityPack(
      ["uint256[4]"],
      [blsSigner.pubkey]
    ));
  }

  dataPayload(
    nonce: any,
    contractAddress: any,
    encodedFunction: string
  ) {
    let encodedFunctionHash = utils.solidityKeccak256(
      ["bytes"],
      [encodedFunction]
    );
    return utils.solidityPack(
      ["uint256","uint256","address","bytes32"],
      [
        this.chainId,
        nonce,
        contractAddress.toString(),
        encodedFunctionHash
      ]
    ); 
  }

  async gatewayCall(
    reward,
    blsSigner,
    nonce,
    contractAddress,
    encodedFunction
  ) {
    let dataToSign = this.dataPayload(
      nonce,
      contractAddress,
      encodedFunction
    );
    let signature = blsSigner.sign(dataToSign);

    // can be called by any ecdsa wallet
    await(await this.verificationGateway.blsCall(
      reward,
      Fixture.blsKeyHash(blsSigner),
      signature,
      contractAddress,
      encodedFunction.substring(0,10),
      '0x'+encodedFunction.substr(10)
    )).wait();
  }


  async createBLSWallet(blsSigner: BlsSignerInterface): Promise<any> {
    const blsPubKeyHash = Fixture.blsKeyHash(blsSigner);

    let encodedFunction = this.VerificationGateway.interface.encodeFunctionData(
      "walletCrossCheck",
      [blsPubKeyHash]
    );
    let dataToSign = await this.dataPayload(
      0,
      this.verificationGateway.address,
      encodedFunction
    );

    let signature = blsSigner.sign(dataToSign);

    // can be called by any ecdsa wallet
    await (await this.verificationGateway.blsCallCreate(
      0,
      blsSigner.pubkey,
      signature,
      this.verificationGateway.address,
      encodedFunction.substring(0,10),
      '0x'+encodedFunction.substr(10)
    )).wait();

    return await this.verificationGateway.walletFromHash(blsPubKeyHash);
  }


  /**
   * Creates new BLS contract wallets from blsSigners
   * @returns array of wallet addresses 
   */
  async createBLSWallets(): Promise<string[]> {
    let blsWalletAddresses = new Array<string>(this.blsSigners.length);
    console.log("Creating wallets...");
    for (let i = 0; i<this.blsSigners.length; i++) {
      blsWalletAddresses[i] = await this.createBLSWallet(this.blsSigners[i]);
    }
    return blsWalletAddresses;
  }
  
}
