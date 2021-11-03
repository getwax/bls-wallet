import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { Signer, Contract, ContractFactory, Wallet } from "ethers";
import { BlsWallet, VerificationGateway } from "bls-wallet-clients";
import { initBlsWalletSigner, BlsWalletSigner } from "bls-wallet-signer";

import Range from "./Range";
import assert from "./assert";
import { Provider } from "@ethersproject/abstract-provider";

export default class Fixture {
  static readonly ECDSA_ACCOUNTS_LENGTH = 5;
  static readonly DEFAULT_BLS_ACCOUNTS_LENGTH = 5;

  private constructor(
    public chainId: number,
    public provider: Provider,

    public signers: Signer[],
    public addresses: string[],

    public lazyBlsWallets: (() => Promise<BlsWallet>)[],

    public vgContractFactory: ContractFactory,
    public vgContract: Contract,
    public verificationGateway: VerificationGateway,

    public BLSExpander: ContractFactory,
    public blsExpander: Contract,

    public BLSWallet: ContractFactory,
    public blsWalletSigner: BlsWalletSigner,
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

    let allSigners = await ethers.getSigners();
    let signers = (allSigners).slice(0, Fixture.ECDSA_ACCOUNTS_LENGTH);
    let addresses = await Promise.all(signers.map(acc => acc.getAddress())) as string[];

    // deploy Verification Gateway
    let vgContractFactory = await ethers.getContractFactory("VerificationGateway");
    let vgContract;
    if (vgAddress) {
      vgContract = vgContractFactory.attach(vgAddress);
      console.log("Attached to VG. blsLib:", await vgContract.blsLib());
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
      vgContract = await vgContractFactory.deploy();
      await vgContract.deployed();
      if (initialized) {
        await (await vgContract.initialize(
          bls.address
        )).wait();
      }
    }

    const verificationGateway = new VerificationGateway(vgContract.address, vgContract.signer);

    let BLSExpander = await ethers.getContractFactory("BLSExpander");
    let blsExpander;
    if (expanderAddress) {
      blsExpander = BLSExpander.attach(expanderAddress);
    }
    else {
      blsExpander = await BLSExpander.deploy(); 
      await blsExpander.deployed();
      await (await blsExpander.initialize(vgContract.address)).wait();
    }

    let BLSWallet = await ethers.getContractFactory("BLSWallet");

    const lazyBlsWallets = Range(blsWalletCount).map(i => {
      let secretNumber: number;

      if (secretNumbers !== undefined) {
        secretNumber = secretNumbers[i];
        assert(secretNumber !== undefined);
      } else {
        secretNumber = Math.abs(Math.random() * 0xffffffff << 0);
      }

      return () => BlsWallet.connectOrCreate(
        `0x${secretNumber.toString(16)}`,
        verificationGateway.address,
        vgContractFactory.signer as Wallet,
      );
    });
  
    return new Fixture(
      chainId,
      ethers.provider,
      signers,
      addresses,
      lazyBlsWallets,
      vgContractFactory,
      vgContract,
      verificationGateway,
      BLSExpander,
      blsExpander,
      BLSWallet,
      await initBlsWalletSigner({ chainId }),
    );
  }

  /**
   * Creates new BLS contract wallets from private keys
   * @returns array of wallets
   */
  async createBLSWallets(): Promise<BlsWallet[]> {
    return await Promise.all(this.lazyBlsWallets.map(
      lazyWallet => lazyWallet(),
    ));
  }
}
