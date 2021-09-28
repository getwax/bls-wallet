import { ethers, network } from "hardhat";
const utils = ethers.utils;

import { BigNumber, Signer, Contract, ContractFactory, getDefaultProvider } from "ethers";

import { BlsSignerFactory, BlsSignerInterface, aggregate } from "../../shared/lib/hubble-bls/src/signer";
import { solG1 } from "../../shared/lib/hubble-bls/src/mcl";
import { keccak256, arrayify, Interface, Fragment, ParamType } from "ethers/lib/utils";

import createBLSWallet from "./createBLSWallet";
import blsSignFunction from "./blsSignFunction";
import blsKeyHash from "./blsKeyHash";
import { exit, send } from "process";

const DOMAIN_HEX = utils.keccak256("0xfeedbee5");
const DOMAIN = arrayify(DOMAIN_HEX);

const zeroBLSPubKey = [0, 0, 0, 0].map(BigNumber.from);
export const zeroAddress = "0x"+"0".repeat(40);

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

export type TxDataCall = {
  publicKeyHash: any;
  tokenRewardAmount: BigNumber;
  ethValue: BigNumber;
  contractAddress: string;
  methodId: string;
  encodedParams: string;
}
export type TxDataSend = {
  publicKeyHash: any;
  tokenRewardAmount: BigNumber;
  recipientAddress: string;
  ethValue: BigNumber;
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
    blsAddress: string=undefined,
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
    
    let BLS = await ethers.getContractFactory("BLSOpen");
    let bls;
    if (blsAddress) {
      bls = BLS.attach(blsAddress);
    }
    else {
      bls = await BLS.deploy();
      await bls.deployed();
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
        await (await verificationGateway.initialize(
          bls.address,
          ethers.constants.AddressZero
        )).wait();
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
      await (await blsExpander.initialize(verificationGateway.address)).wait();
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

  static txDataFromFull(fullTxData: FullTxData): TxDataCall|TxDataSend {
    let sendOnly = (fullTxData.functionName === "");

    if (sendOnly) {
      return {
        publicKeyHash: blsKeyHash(fullTxData.blsSigner),
        tokenRewardAmount: fullTxData.reward,
        ethValue: fullTxData.ethValue,
        recipientAddress: fullTxData.contract.address
      } as TxDataSend;
    }
    else {
      let encodedFunction = fullTxData.contract.interface.encodeFunctionData(
        fullTxData.functionName,
        fullTxData.params
      );

      return {
        publicKeyHash: blsKeyHash(fullTxData.blsSigner),
        tokenRewardAmount: fullTxData.reward,
        ethValue: fullTxData.ethValue,
        contractAddress: fullTxData.contract.address,
        methodId: (encodedFunction!="")?encodedFunction.substring(0,10):"0x00000000",
        encodedParams: (encodedFunction!="")?'0x'+encodedFunction.substr(10):"0x00"
      } as TxDataCall;
    }
  }

  async gatewaySend(txDataFull: FullTxData, address: string) {
    txDataFull.functionName = "";
    let [txData, sig] = blsSignFunction(txDataFull, address);
    await this.blsSendSigned(txData as TxDataSend, sig);
  }

  async blsSendSigned(txData: TxDataSend, sig: solG1) {
    // can be called by any ecdsa wallet
    await(await this.verificationGateway.blsSend(
      txData.publicKeyHash,
      sig,
      txData.tokenRewardAmount,
      txData.ethValue,
      txData.recipientAddress
    )).wait();
  }
  async gatewayCallFull(txDataFull: FullTxData) {
    let [txData, sig] = blsSignFunction(txDataFull);
    await this.blsCallSigned(txData as TxDataCall, sig);
  }

  async blsCallSigned(txData: TxDataCall, sig: solG1) {
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
    rewardAddress: string = zeroAddress,
    reward: BigNumber = BigNumber.from(0)
  ): Promise<any> {
    return await createBLSWallet(
      this.chainId,
      this.verificationGateway,
      blsSigner,
      this.addresses[0],
      rewardAddress,
      reward
    );
  }

  /**
   * Creates new BLS contract wallets from blsSigners
   * @returns array of wallet addresses 
   */
  async createBLSWallets(
    rewardAddress: string = zeroAddress,
    reward: BigNumber = BigNumber.from(0)
    ): Promise<string[]> {
    const length = this.blsSigners.length;
    let blsWalletAddresses = new Array<string>(length);
    for (let i = 0; i<length; i++) {
      blsWalletAddresses[i] = await this.createBLSWallet(
        this.blsSigners[i],
        rewardAddress,
        reward
      );
    }
    return blsWalletAddresses;
  }
  
}
