import { ethers } from "../../deps/index.ts";
import ovmContractABIs from "../../ovmContractABIs/index.ts";

export default class MockErc20 {
  contract: ethers.Contract;

  constructor(
    address: string,
    provider: ethers.providers.Provider,
  ) {
    this.contract = new ethers.Contract(
      address,
      ovmContractABIs["MockERC20.json"].abi,
      provider,
    );
  }

  async balanceOf(address: string): Promise<ethers.BigNumber> {
    return await this.contract.balanceOf(address);
  }
}
