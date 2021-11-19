import { Bundle } from "./signer";
import { ethers } from "ethers";

import VerificationGatewayAbi from "./contractAbis/VerificationGatewayAbi";

type Signer = ethers.Signer;
type Provider = ethers.providers.Provider;

export default class VerificationGateway {
  static abi = VerificationGatewayAbi;

  contract: ethers.Contract;

  constructor(
    public address: string,
    signerOrProvider: Signer | Provider | undefined = undefined,
  ) {
    this.contract = new ethers.Contract(
      address,
      VerificationGateway.abi,
      signerOrProvider,
    );
  }

  async actionCalls(
    bundle: Bundle,
    overrides: ethers.Overrides = {},
  ): Promise<ethers.providers.TransactionResponse> {
    return await this.contract.actionCalls(bundle, overrides);
  }

  async walletFromHash(publicKeyHash: string): Promise<string> {
    return await this.contract.walletFromHash(publicKeyHash);
  }
}
