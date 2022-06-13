# Local Development

These steps will setup this repo on your machine for local development for the majority of the components in this repo.
If you would like to target a remote network instead, add the addtional steps in [Remote Development](./remote_development.md) as well.

## Dependencies

### Required

- [NodeJS](https://nodejs.org)
- [Yarn](https://yarnpkg.com/getting-started/install) (`npm install -g yarn`)
- [Deno](https://deno.land/#installation)

### Optional (Recomended)

- [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- [docker-compose](https://docs.docker.com/compose/install/)

## Setup

Run the repo setup script
```sh
./setup.ts
```

Then choose to target either a local Hardhat node or the Arbitrum Testnet.

### Chain & Contracts

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
You will need write access to the npmjs project to do this. You can request access or request one of the BLS Wallet project developers push up your client changes in the `Discussions` section of this repo.

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
