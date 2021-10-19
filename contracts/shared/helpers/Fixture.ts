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

export type FullTxData = {
  blsSigner: BlsSignerInterface,
  chainId: number,
  nonce: number,
  ethValue: BigNumber,
  contract: Contract|string, // Contract for calls, address string for sending ETH
  functionName: string, // empty string for sending ETH
  params: any[]
}

export type TxData = {
  publicKeyHash: any;
  nonce: BigNumber;
  ethValue: BigNumber;
  contractAddress: string;
  encodedFunction: string;
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

    // deploy Verification Gateway
    let VerificationGateway = await ethers.getContractFactory("VerificationGateway");
    let verificationGateway;
    if (vgAddress) {
      verificationGateway = VerificationGateway.attach(vgAddress);
      console.log("Attached to VG. blsLib:", await verificationGateway.blsLib());
    }
    else {
      let BLS = await ethers.getContractFactory("BLSOpen");
      let bls;
      if (blsAddress) {
        bls = BLS.attach(blsAddress);
      }
      else {
        bls = await BLS.deploy();
        await bls.deployed();
      }
      verificationGateway = await VerificationGateway.deploy();
      await verificationGateway.deployed();
      if (initialized) {
        await (await verificationGateway.initialize(
          bls.address
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
      BLSWallet
    );
  }

  async gatewayCallFull(txDataFull: FullTxData) {
    let [txData, sig] = blsSignFunction(txDataFull);

    await(await this.verificationGateway.actionCalls(
      [txDataFull.blsSigner.pubkey],
      sig,
      [txData]
    )).wait();
  }

  async createBLSWallet(
    blsSigner: BlsSignerInterface,
    rewardAddress: string = ethers.constants.AddressZero,
    reward: BigNumber = BigNumber.from(0)
  ): Promise<any> {
    const blsPubKeyHash = blsKeyHash(blsSigner);

    const existingAddress: string = await this.verificationGateway.walletFromHash(
      blsPubKeyHash,
    );
    if (existingAddress !== ethers.constants.AddressZero) {
      return existingAddress;
    }

    await this.gatewayCallFull({
      blsSigner: blsSigner,
      chainId: this.chainId,
      nonce: 0,
      ethValue: BigNumber.from(0),
      contract: this.verificationGateway,
      functionName: "walletCrossCheck",
      params: [blsPubKeyHash]
    });

    return (await this.verificationGateway.walletFromHash(blsPubKeyHash)) as string;
  }

  /**
   * Creates new BLS contract wallets from blsSigners
   * @returns array of wallet addresses 
   */
  async createBLSWallets(
    rewardAddress: string = ethers.constants.AddressZero,
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
