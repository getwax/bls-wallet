# Remote Development

These steps will setup this repo on your machine for targeting a remote chain, such as an EVM compatible L2.

Follow the instructions for [Local Development](./local_development.md), replacing the sections titled `Chain` and `Contracts` with the steps below.

## Deploy Contracts

### Deployer account

BLS Wallet contract deploys use `CREATE2` to maintain consistent addresses across networks. As such, a create2 deployer contract is used and listed in `./contracts/.env` under the environment variables `DEPLOYER_MNEMONIC` & `DEPLOYER_SET_INDEX`. The HD address will need to be funded in order to deploy the contracts.

If you do not need consistent addresses, for example on a local or testnet network, you can replace the `DEPLOYER_MNEMONIC` with another seed phrase which already has a funded account.

### Update hardhat.config.ts

If your network is not listed in [hardhat.config.ts](../contracts/hardhat.config.ts), you will need to add it.

### Precompile Cost Estimator

If your network does not already have an instance of the [BNPairingPrecompileCostEstimator contract](../contracts/contracts/lib/hubble-contracts/contracts/libs/BNPairingPrecompileCostEstimator.sol), you will need to deploy that.

```sh
cd ./contracts
yarn hardhat run scripts/0_deploy_precompile_cost_estimator.ts --network YOUR_NETWORK
```
Copy the address that is output.

Update `./contracts/contracts/lib/hubble-contracts/contracts/libs/BLS.sol`'s `COST_ESTIMATOR_ADDRESS` to the value of that address if it is different:
```solidity
...
address private constant COST_ESTIMATOR_ADDRESS = YOUR_NETWORKS_PRECOMPILE_COST_ESTIMATOR_ADDRESS;
...
```

### Remaining Contracts

Deploy all remaining `bls-wallet` contracts.
```sh
cd ./contracts # if not already there
yarn hardhat run scripts/deploy_all.ts --network YOUR_NETWORK
```

A network config file will be generated at `./contracts/networks/local.json`. You should rename it to match your network.

```sh
mv ./networks/local.json ./networks/your-network.json
```

This file can be commited so others can use your deployed contracts.

## Remote RPC

### Aggregator

Update these values in `./aggregator/.env`.
PK0 & PK1 are private keys for funded accounts on your network/chain.
```
RPC_URL=https://your.network.rpc
...
NETWORK_CONFIG_PATH=../contracts/networks/your-network.json
PRIVATE_KEY_AGG=PK0
PRIVATE_KEY_ADMIN=PK1
...
```

### Extension

Check the [controller constants file](../extension/source/Controllers/constants.ts) to see if your network is already added. If not, you will need to add chainid & supported networks entries for your network/chain. These changes can be committed.

Then, update this value in `./extension/.env`.
```
...

DEFAULT_CHAIN_ID=YOUR_CHAIN_ID
...
```

## Run

Follow the remaing instruction in [Local Development](./local_development.md) starting with the `Run` section.

## Example: Arbitrum Testnet (Rinkeby Arbitrum Testnet)

You will need two ETH addresses with Rinkeby ETH and their private keys (PK0 & PK1) for running the aggregator. It is NOT recommended that you use any primary wallets with ETH Mainnet assets.

You can get Rinkeby ETH at https://app.mycrypto.com/faucet, and transfer it into the Arbitrum testnet via https://bridge.arbitrum.io/. Make sure when doing so that your network is set to Rinkeby in your web3 wallet extension, such as MetaMask.

Update these values in `./aggregator/.env`.
```
RPC_URL=https://rinkeby.arbitrum.io/rpc
...
NETWORK_CONFIG_PATH=../contracts/networks/arbitrum-testnet.json
PRIVATE_KEY_AGG=PK0
PRIVATE_KEY_ADMIN=PK1
...
```

And then update this value in `./extension/.env`.
```
...

DEFAULT_CHAIN_ID=421611
...
```
