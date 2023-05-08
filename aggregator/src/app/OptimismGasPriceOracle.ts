import { BigNumber, ethers } from "../../deps.ts";
import assert from "../helpers/assert.ts";

export default class OptimismGasPriceOracle {
  static address = "0x420000000000000000000000000000000000000F";

  constructor(
    public provider: ethers.providers.Provider,
  ) {}

  async l1BaseFee() {
    const outputBytes = await this.provider.call({
      to: OptimismGasPriceOracle.address,
      data: ethers.utils.id("l1BaseFee()"),
    });

    const result = ethers.utils.defaultAbiCoder.decode(
      ["uint256"],
      outputBytes,
    )[0];

    assert(result instanceof BigNumber);

    return result;
  }

  async overhead() {
    const outputBytes = await this.provider.call({
      to: OptimismGasPriceOracle.address,
      data: ethers.utils.id("overhead()"),
    });

    const result = ethers.utils.defaultAbiCoder.decode(
      ["uint256"],
      outputBytes,
    )[0];

    assert(result instanceof BigNumber);

    return result;
  }
}
