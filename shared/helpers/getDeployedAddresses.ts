
export interface DeployedAddresses {
  ethAddress: string|undefined;
  rewardAddress: string|undefined;
  vgAddress: string|undefined;
  expanderAddress: string|undefined;
  tokenAddress: string|undefined;
  blsAddresses: string[]|undefined;
}

export default function getDeployedAddresses(networkName: string): DeployedAddresses {
  if (networkName === `arb1`) {
    return {
      ethAddress:undefined,
      rewardAddress: process.env.ARB1_REWARD_CONTRACT_ADDRESS,
      vgAddress:process.env.ARB1_VERIFICATION_GATEWAY_ADDRESS,
      expanderAddress: process.env.ARB1_BLS_EXPANDER_ADDRESS,
      tokenAddress: undefined,
      blsAddresses: [
      ]
    };
  }
  else if (networkName === `rinkarby`) {
    return {
      ethAddress:undefined,
      rewardAddress: process.env.RINKARBY_REWARD_CONTRACT_ADDRESS,
      vgAddress:process.env.RINKARBY_VERIFICATION_GATEWAY_ADDRESS,
      expanderAddress: process.env.RINKARBY_BLS_EXPANDER_ADDRESS,
      tokenAddress: undefined,
      blsAddresses: [
        '0xB006321626aF3789c152E11Abf6054C33B1ba718',
        '0xF3694cd3d984d184E11673d422E7A75F5106ee0b',
        '0x9Ae1D3cEA9F25F8846400f31dE6e6eE0E781b72F'
      ]
    };
  }
  else if (networkName === `optimistic`) {
    return {
      ethAddress:undefined,
      rewardAddress: process.env.LOCAL_REWARD_CONTRACT_ADDRESS,
      vgAddress:process.env.LOCAL_VERIFICATION_GATEWAY_ADDRESS,
      expanderAddress: process.env.LOCAL_BLS_EXPANDER_ADDRESS,
      tokenAddress: undefined,
      blsAddresses: [
        '0x69A9c53e7000c8B7aF3f70212ba7a8E30fB30Cb4',
        '0xAeaDee30db4e75c64BC8ABE54f818b8fc9097f1b',
        '0x4FCa9CA9938Ee6b4E3200a295b1152c72d6df0b7'
      ]
    };
  }
  else if (networkName === `optimisticKovan`) {
    return {
      ethAddress: process.env.OKOVAN_ETH_CONTRACT_ADDRESS,
      vgAddress: process.env.OKOVAN_VERIFICATION_GATEWAY_ADDRESS,
      expanderAddress: process.env.OKOVAN_BLS_EXPANDER_ADDRESS,
      rewardAddress: process.env.OKOVAN_REWARD_CONTRACT_ADDRESS,
      tokenAddress: process.env.OKOVAN_ERC20_CONTRACT_ADDRESS,
      blsAddresses: [
        '0xEc76AE8adEFc6462986A673Feff40b2Cdd56B3BC',
        '0x808AeC84A987368B915a7Fd048cd1B20859FcbC9',
        '0x00478B7Ea27581f901D84a7ea2989f68416d3568'
      ]
    }
  } else {
    throw new Error(`No configuration for: "${networkName}"`);
  }
}