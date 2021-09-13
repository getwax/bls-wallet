import { ethers, network } from "hardhat";
const utils = ethers.utils;

import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";

import { BlsSignerFactory, BlsSignerInterface, aggregate } from "../lib/hubble-bls/src/signer";
import { solG1 } from "../lib/hubble-bls/src/mcl"
import { keccak256, arrayify, Interface, Fragment, ParamType } from "ethers/lib/utils";

import createBLSWallet from "./createBLSWallet";
import blsSignFunction from "./blsSignFunction";
import blsKeyHash from "./blsKeyHash";

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

const zeroBLSPubKey = [0, 0, 0, 0].map(BigNumber.from);

export type FullTxData = {
  blsSigner: BlsSignerInterface,
  chainId: number,
  nonce: number,
  reward: BigNumber,
  ethValue: BigNumber,
  contract: Contract,
  functionName: string,
  params: any[]
}

export type TxData = {
  publicKeyHash: any;
  tokenRewardAmount: BigNumber;
  ethValue: BigNumber;
  contractAddress: string;
  methodId: string;
  encodedParams: string;
}

export default class Fixture {
  
  static readonly ECDSA_ACCOUNTS_LENGTH = 5;
  static readonly DEFAULT_BLS_ACCOUNTS_LENGTH = 5;

  private constructor(
    public chainId: number,
    public provider,

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
    let provider = ethers.provider;

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
        await verificationGateway.initialize(ethers.constants.AddressZero);
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
      ethers.provider,
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

  // static blsKeyHash(blsSigner: BlsSignerInterface) {
  //   return keccak256(utils.solidityPack(
  //     ["uint256[4]"],
  //     [blsSigner.pubkey]
  //   ));
  // }

  static txDataFromFull(fullTxData: FullTxData) {
    let encodedFunction = fullTxData.contract.interface.encodeFunctionData(
      fullTxData.functionName,
      fullTxData.params
    );

    let txData: TxData = {
      publicKeyHash: blsKeyHash(fullTxData.blsSigner),
      tokenRewardAmount: fullTxData.reward,
      ethValue: fullTxData.ethValue,
      contractAddress: fullTxData.contract.address,
      methodId: encodedFunction.substring(0,10),
      encodedParams: '0x'+encodedFunction.substr(10)
    }
    return txData
  }

  async gatewayCallFull(txDataFull: FullTxData) {
    let [txData, sig] = blsSignFunction(txDataFull);
    await this.blsCallSigned(txData, sig);
  }

  async blsCallSigned(txData: TxData, sig: solG1) {
    // can be called by any ecdsa wallet
    await(await this.verificationGateway.blsCall(
      txData.publicKeyHash,
      sig,
      txData.tokenRewardAmount,
      txData.ethValue,
      txData.contractAddress,
      txData.methodId,
      txData.encodedParams
    )).wait();
  }

  async createBLSWallet(
    blsSigner: BlsSignerInterface,
    reward: BigNumber = BigNumber.from(0)
  ): Promise<any> {
    return await createBLSWallet(
      this.chainId,
      this.verificationGateway,
      blsSigner,
      reward
    );
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
