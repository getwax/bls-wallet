
import { ethers, network } from "hardhat";

import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";
const utils = ethers.utils;

import { BlsSignerFactory, BlsSignerInterface, aggregate } from "../lib/hubble-bls/src/signer";
import { keccak256, arrayify, Interface, Fragment, ParamType } from "ethers/lib/utils";

import dataPayload from "./dataPayload";

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

const zeroBLSPubKey = [0, 0, 0, 0].map(BigNumber.from);
const zeroAddress = "0x0000000000000000000000000000000000000000";

export type TxData = {
  publicKeyHash: any;
  tokenRewardAmount: BigNumber;
  contractAddress: string;
  methodID: string;
  encodedParams: string;
}

export default class Fixture {
  
  static readonly ECDSA_ACCOUNTS_LENGTH = 5;
  static readonly DEFAULT_BLS_ACCOUNTS_LENGTH = 5;

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

    public encodedCreate: string,

    public BLSWallet: ContractFactory,
  ) {}

  /// @dev Contracts deployed by first ethers signer 
  static async create(
    blsWalletCount: number=Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH,
    initialized: boolean=true,
    vgAddress: string=undefined,
    expanderAddress: string=undefined,
    secretNumbers: number[]=undefined
  ) {
    let chainId = (await ethers.provider.getNetwork()).chainId;

    let allSigners = await ethers.getSigners();
    let signers = (allSigners).slice(0, Fixture.ECDSA_ACCOUNTS_LENGTH);
    let addresses = await Promise.all(signers.map(acc => acc.getAddress())) as string[];

    let blsSignerFactory = await BlsSignerFactory.new();
    let blsSigners = new Array(blsWalletCount);
    for (let i=0; i<blsSigners.length; i++) {
      let secretNumber = Math.abs(Math.random() * 0xffffffff << 0);
      if (secretNumbers) {
        secretNumber = secretNumbers[i]; // error here if not enough numbers provided
      }
      blsSigners[i] = blsSignerFactory.getSigner(DOMAIN, "0x"+secretNumber.toString(16));
    }

    // deploy Verification Gateway
    let VerificationGateway = await ethers.getContractFactory("VerificationGateway");
    let verificationGateway;
    if (vgAddress) {
      verificationGateway = VerificationGateway.attach(vgAddress);
    }
    else {
      verificationGateway = await VerificationGateway.deploy();
      await verificationGateway.deployed();
      if (initialized) {
        await verificationGateway.initialize(zeroAddress);
      }
    }

    let BLSExpander = await ethers.getContractFactory("BLSExpander");
    let blsExpander;
    if (expanderAddress) {
      blsExpander = BLSExpander.attach(expanderAddress);
    }
    else {
      blsExpander = await BLSExpander.deploy(); 
      await blsExpander.deployed();
      await blsExpander.initialize(verificationGateway.address);
    }

    let encodedCreate = utils.defaultAbiCoder.encode(
      ["string"],
      ["Create BLS Wallet."]
    );

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
      encodedCreate,
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
    reward: BigNumber,
    contractAddress: any,
    encodedFunction: string
  ) {
    return dataPayload(
      this.chainId,
      nonce,
      reward,
      contractAddress,
      encodedFunction
    );
  }

  async gatewayCall(
    blsSigner,
    nonce,
    reward,
    contractAddress,
    encodedFunction
  ) {
    let dataToSign = this.dataPayload(
      nonce,
      reward,
      contractAddress,
      encodedFunction
    );
    let signature = blsSigner.sign(dataToSign);

    // can be called by any ecdsa wallet
    await(await this.verificationGateway.blsCall(
      Fixture.blsKeyHash(blsSigner),
      signature,
      reward,
      contractAddress,
      encodedFunction.substring(0,10),
      '0x'+encodedFunction.substr(10)
    )).wait();
  }

  async createBLSWallet(
    blsSigner: BlsSignerInterface,
    reward: BigNumber = BigNumber.from(0)
  ): Promise<any> {
    const blsPubKeyHash = Fixture.blsKeyHash(blsSigner);

    let encodedFunction = this.VerificationGateway.interface.encodeFunctionData(
      "walletCrossCheck",
      [blsPubKeyHash]
    );
    let dataToSign = await this.dataPayload(
      0,
      reward,
      this.verificationGateway.address,
      encodedFunction
    );

    let signature = blsSigner.sign(dataToSign);

    // can be called by any ecdsa wallet
    await (await this.verificationGateway.blsCallCreate(
      blsSigner.pubkey,
      signature,
      reward,
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
  async createBLSWallets(reward: BigNumber = BigNumber.from(0)): Promise<string[]> {
    const length = this.blsSigners.length;
    let blsWalletAddresses = new Array<string>(length);
    for (let i = 0; i<length; i++) {
      blsWalletAddresses[i] = await this.createBLSWallet(
        this.blsSigners[i],
        reward
      );
    }
    return blsWalletAddresses;
  }
  
}
