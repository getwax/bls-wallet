import { BigNumber, ethers } from "../../deps.ts";

import MockERC20Abi from "../../contractAbis/MockERC20Abi.ts";

export default class MockErc20 {
  contract: ethers.Contract;

  constructor(
    address: string,
    provider: ethers.providers.Provider | ethers.Signer,
  ) {
    this.contract = new ethers.Contract(
      address,
      MockERC20Abi,
      provider,
    );
  }

  async balanceOf(address: string): Promise<BigNumber> {
    return await this.contract.balanceOf(address);
  }

  async mint(address: string, amount: BigNumber) {
    await (await this.contract.mint(
      address,
      amount,
    )).wait();
  }
}
