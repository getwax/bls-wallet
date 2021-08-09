import { blsSignerFactory, Contract, ethers } from "../../deps/index.ts";

import ovmContractABIs from "../../ovmContractABIs/index.ts";
import * as env from "../env.ts";
import assert from "../helpers/assert.ts";
import blsKeyHash from "./blsKeyHash.ts";
import domain from "./domain.ts";

export default class Wallet {
  private constructor(
    public provider: ethers.providers.Provider,
    public network: ethers.providers.Network,
    public verificationGateway: Contract,
    public blsSignerAddress: string,
    public walletAddress: string,
    public walletContract: Contract,
  ) {}

  static async connect(
    blsSignerAddress: string,
    provider = new ethers.providers.JsonRpcProvider(),
  ) {
    const blsSigner = blsSignerFactory.getSigner(domain, blsSignerAddress);

    const blsPubKeyHash = blsKeyHash(blsSigner);

    const verificationGateway = new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs["VerificationGateway.json"].abi,
      // this.aggregatorSigner,
    );

    const walletAddress: string = await verificationGateway.walletFromHash(
      blsPubKeyHash,
    );

    assert(
      walletAddress !== ethers.constants.AddressZero,
      "Wallet does not exist",
    );

    const walletContract = new ethers.Contract(
      walletAddress,
      ovmContractABIs["BLSWallet.json"].abi,
      // this.walletService.aggregatorSigner,
    );

    return new Wallet(
      provider,
      await provider.getNetwork(),
      verificationGateway,
      blsSignerAddress,
      walletAddress,
      walletContract,
    );
  }
}
