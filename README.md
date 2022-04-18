# bls-wallet

An Ethereum Layer 2 smart contract wallet that uses [BLS signatures](https://en.wikipedia.org/wiki/BLS_digital_signature) and aggregated transactions to reduce gas costs.

## Components

See each component's directory `README` for more details.

![System Overview](images/system-overview.svg)

### Aggregator

Service which aggregates BLS wallet transactions.

### Clients

TS/JS Client libraries for web apps and services.

### Contracts

`bls-wallet` Solidity contracts.

### Extension

Quill browser extension used to manage BLS Wallets and sign transactions.

### Signer

TS/JS BLS Signing lib.

## Dependencies

### Required

- [NodeJS](https://nodejs.org)
- [Yarn](https://yarnpkg.com/getting-started/install) (`npm install -g yarn`)
- [Deno](https://deno.land/#installation)

### Optional (Recomended)

- [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- [docker-compose](https://docs.docker.com/compose/install/)
- [MetaMask](https://metamask.io/)

## Setup

Run the repo setup script
```sh
./setup.ts
```

Then choose to target either a local Hardhat node or the Arbitrum Testnet.

### Local

Start a local Hardhat node for RPC use.
```sh
cd ./contracts
yarn hardhat node
```

You can use any two of the private keys displayed (PK0 & PK1) to update these values in `./aggregator/.env`.
```
...
PRIVATE_KEY_AGG=PK0
PRIVATE_KEY_ADMIN=PK1
...
```

Set this value in `./contracts/.env` (This mnemonic is special to hardhat and has funds).
```
...
DEPLOYER_MNEMONIC="test test test test test test test test test test test junk"
...
```

Deploy the PrecompileCostEstimator contract.
```sh
yarn hardhat run scripts/0_deploy_precompile_cost_estimator.ts --network gethDev
```
Copy the address that is output.

Update `./contracts/contracts/lib/hubble-contracts/contracts/libs/BLS.sol`'s `COST_ESTIMATOR_ADDRESS` to the value of that address;
```solidity
...
address private constant COST_ESTIMATOR_ADDRESS = 0x57047C275bbCb44D85DFA50AD562bA968EEba95A;
...
```

Deploy all remaining `bls-wallet` contracts.
```sh
yarn hardhat run scripts/deploy_all.ts --network gethDev
```

### Arbitrum Testnet (Rinkeby Arbitrum Testnet)

You will need two ETH addresses with Rinkeby ETH and their private keys (PK0 & PK1) for running the aggregator. It is NOT recommended that you use any primary wallets with ETH Mainnet assets.

You can get Rinkeby ETH at https://app.mycrypto.com/faucet, and transfer it into the Arbitrum testnet via https://bridge.arbitrum.io/. Make sure when doing so that your network is set to Rinkeby in MetaMask.

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

## Run

```sh
docker-compose up -d postgres # Or see local postgres instructions in ./aggregator/README.md#PostgreSQL
cd ./aggregator
./programs/aggregator.ts
```

In a seperate terminal/shell instance
```sh
cd ./extension
yarn run dev:chrome # or dev:firefox, dev:opera
```

### Chrome

1. Go to Chrome's [extension page](chrome://extensions).
2. Enable `Developer mode`.
3. Either click `Load unpacked extension...` and select `./extension/extension/chrome` or drag that folder into the page.

### Firefox

1. Go to Firefox's [debugging page](about:debugging#/runtime/this-firefox).
2. Click `Load Temporary Add-on...`.
3. Select `./extension/extension/firefox/manifest.json`.

## Testing/using updates to ./clients

### extension
```sh
cd ./contracts/clients
yarn build
yarn link
cd ../extension
yarn link bls-wallet-clients
```

### aggregator

You will need to push up an `@experimental` version to 'bls-wallet-clients' on npm and update the version in `./aggregtor/src/deps.ts` until a local linking solution for deno is found. See https://github.com/alephjs/esm.sh/discussions/216 for details.

In `./contracts/clients` with your changes:
```
yarn publish-experimental
```
Note the `x.y.z-abc1234` version that was output.

Then in `./aggregtor/deps.ts`, change all `from` references for that package.
```typescript
...
} from "https://esm.sh/bls-wallet-clients@x.y.z-abc1234";
...
```
