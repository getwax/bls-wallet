import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { Signer, Contract, ContractFactory, BigNumber } from "ethers";
import { Provider } from "@ethersproject/abstract-provider";

import {
  BlsWalletWrapper,
  BlsWalletSigner,
  initBlsWalletSigner,
  VerificationGateway,
} from "../../clients/src";

import Range from "./Range";
import assert from "./assert";
import Create2Fixture from "./Create2Fixture";

export default class Fixture {
  static readonly ECDSA_ACCOUNTS_LENGTH = 5;
  static readonly DEFAULT_BLS_ACCOUNTS_LENGTH = 5;

  private constructor(
    public chainId: number,
    public provider: Provider,

    public signers: Signer[],
    public addresses: string[],

    public lazyBlsWallets: (() => Promise<BlsWalletWrapper>)[],

    public verificationGateway: VerificationGateway,

    public blsExpander: Contract,

    public BLSWallet: ContractFactory,
    public blsWalletSigner: BlsWalletSigner,
  ) {}

  /// @dev Contracts deployed by first ethers signer 
  static async create(
    blsWalletCount: number=Fixture.DEFAULT_BLS_ACCOUNTS_LENGTH,
    initialized: boolean=true,
    blsAddress?: string,
    vgAddress?: string,
    expanderAddress?: string,
    secretNumbers?: number[]
  ) {
    let chainId = (await ethers.provider.getNetwork()).chainId;

    let allSigners = await ethers.getSigners();
    let signers = (allSigners).slice(0, Fixture.ECDSA_ACCOUNTS_LENGTH);
    let addresses = await Promise.all(signers.map(acc => acc.getAddress())) as string[];

    let create2Fixture = Create2Fixture.create();

    // deploy wallet implementation contract
    let blsWalletImpl = await create2Fixture.create2Contract("BLSWallet");
    try {
      await (await blsWalletImpl.initialize(
        ethers.constants.AddressZero
      )).wait();
    } catch (e) {}

    // deploy Verification Gateway
    let vgContract = await create2Fixture.create2Contract("VerificationGateway");
    let bls = await create2Fixture.create2Contract("BLSOpen");

    try {
      await (await vgContract.initialize(
        bls.address,
        blsWalletImpl.address
      )).wait();
    } catch (e) {}

    // deploy BLSExpander Gateway
    let blsExpander = await create2Fixture.create2Contract("BLSExpander");
    try {
      await (await blsExpander.initialize(vgContract.address)).wait();
    } catch (e) {}

    const verificationGateway = new VerificationGateway(vgContract.address, vgContract.signer);

    let BLSWallet = await ethers.getContractFactory("BLSWallet");

    const lazyBlsWallets = Range(blsWalletCount).map(i => {
      let secretNumber: number;

      if (secretNumbers !== undefined) {
        secretNumber = secretNumbers[i];
        assert(secretNumber !== undefined);
      } else {
        secretNumber = Math.abs(Math.random() * 0xffffffff << 0);
      }

      return async () => {
        const wallet = await BlsWalletWrapper.connect(
          `0x${secretNumber.toString(16)}`,
          verificationGateway.address,
          vgContract.provider,
        );

        // Perform an empty transaction to trigger wallet creation
        await (await verificationGateway.actionCalls(wallet.sign({
          nonce: BigNumber.from(0),
          atomic: true,
          actions: [],
        }))).wait();

        return wallet;
      }
    });
  
    return new Fixture(
      chainId,
      ethers.provider,
      signers,
      addresses,
      lazyBlsWallets,
      verificationGateway,
      blsExpander,
      BLSWallet,
      await initBlsWalletSigner({ chainId }),
    );
  }

  /**
   * Creates new BLS contract wallets from private keys
   * @returns array of wallets
   */
  async createBLSWallets(): Promise<BlsWalletWrapper[]> {
    return await Promise.all(this.lazyBlsWallets.map(
      lazyWallet => lazyWallet(),
    ));
  }
}
