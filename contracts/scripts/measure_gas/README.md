# Gas Measurments Script

This script runs a variety of gas measurements on both normal EVM transactions as well as their BLS Wallet equivalents to aid in analyzing the costs and benefits of each. It specifically targets optimisitic rollups but should be runnable on any EVM network/chain.

## setup

Make sure that the BLS Wallet repo is setup and the contracts are deployed [locally](../../../docs/local_development.md) or to a [remote network](../../../docs/remote_development.md)

## configuration

You can modifiy the measurements that will be run as well as other parameters in [run.ts](./run.ts)

## run

```sh
yarn hardhat run ./scripts/measure_gas/run.ts --network network_from_hardhat_config
```

## file structure

[configs](./configs/)

Gas measurement tasks that can be run

[networks](./networks/)

Network specific gas stats processing outside of those defined for the EVM

[run.ts](./run.ts)

Entrypoint to run the gas measurement script

### everthing else

Utilities to aid in setup and gas measurements
