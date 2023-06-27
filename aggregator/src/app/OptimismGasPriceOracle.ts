import { BigNumber, ethers } from "../../deps.ts";
import assert from "../helpers/assert.ts";
import { OPTIMISM_GAS_PRICE_ORACLE_ADDRESS } from "../env.ts";

export default class OptimismGasPriceOracle {
  constructor(
    public provider: ethers.providers.Provider,
  ) {}

  private async callFn(method: string, blockTag?: ethers.providers.BlockTag) {
    const outputBytes = await this.provider.call({
      to: OPTIMISM_GAS_PRICE_ORACLE_ADDRESS,
      data: ethers.utils.id(method),
    }, blockTag);

    const result = ethers.utils.defaultAbiCoder.decode(
      ["uint256"],
      outputBytes,
    )[0];

    assert(result instanceof BigNumber);

    return result;
  }

  async l1BaseFee(blockTag?: ethers.providers.BlockTag) {
    return await this.callFn("l1BaseFee()", blockTag);
  }

  async overhead(blockTag?: ethers.providers.BlockTag) {
    return await this.callFn("overhead()", blockTag);
  }

  async scalar(blockTag?: ethers.providers.BlockTag) {
    return await this.callFn("scalar()", blockTag);
  }

  async decimals(blockTag?: ethers.providers.BlockTag) {
    return await this.callFn("decimals()", blockTag);
  }

  async getAllParams(blockTag?: ethers.providers.BlockTag) {
    const [l1BaseFee, overhead, scalar, decimals] = await Promise.all([
      this.l1BaseFee(blockTag),
      this.overhead(blockTag),
      this.scalar(blockTag),
      this.decimals(blockTag),
    ]);

    return { l1BaseFee, overhead, scalar, decimals };
  }
}
