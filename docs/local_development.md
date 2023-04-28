# Local Development

These steps will setup this repo on your machine for local development for the majority of the components in this repo.
By default the extension will connect to contracts already deployed on Arbitrum Nitro testnet and a public Aggregator running on https://arbitrum-goerli.blswallet.org/
If you would like to target a remote network instead, follow the steps outlined in [Remote Development](./remote_development.md).

If you're running a Windows machine, we recommend using [WSL2](https://learn.microsoft.com/en-us/windows/wsl/).

## Dependencies

### Required

- [NodeJS](https://nodejs.org)
- [Yarn](https://yarnpkg.com/getting-started/install) (`npm install -g yarn`)
- [Deno](https://deno.land/#installation)

### Optional (Recommended)

- [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- [docker-compose](https://docs.docker.com/compose/install/)

## Setup

Install the latest Node 16. If using nvm to manage node versions, run this in the root directory:

```sh
nvm install
```

Run the repo setup script

```sh
./setup.ts
```

## Chain (RPC Node)

Set up a local node and deploy the contracts on it.

```sh
cd ./contracts
yarn start
```

You can also use the local node from hardhat.

- Pros: doesn't need docker, access to console.log in solidity
- Cons: slow

```sh
cd ./contracts
yarn start-hardhat
```

## Aggregator

The [aggregator](../aggregator/) is a service that accepts transaction bundles (including those that contain a single transaction) and submits aggregations of these bundles to L2.

```sh
cd ./aggregator
cp .env.local.example .env
```

> **Note: The .env file in the aggregator needs to be updated everytime the network changes from local to remote and vice-versa.**

> **.env.local.example** for **local**

([More aggregator configuration docs.](../aggregator/README.md#configuration))

```sh
./programs/aggregator.ts
```

## Extension

The [extension](../extension/) (otherwise referred to as Quill) is a prototype extension wallet used to showcase and test BLS Wallet features. **Note it is not a production wallet.**

In a separate terminal/shell instance

```sh
cd ./extension
yarn run dev:chrome # or dev:firefox, dev:opera
```

### Chrome

1. Go to Chrome's [extension page](chrome://extensions).
2. Enable `Developer mode`.
3. Either click `Load unpacked extension...` and select `./extension/extension/chrome` or drag that folder into the page.
4. Transfer ETH from a funded account to Quill - e.g. an imported MetaMask account

### Firefox

1. Go to Firefox's [debugging page](about:debugging#/runtime/this-firefox).
2. Click `Load Temporary Add-on...`.
3. Select `./extension/extension/firefox/manifest.json`.

**After this, you now have all the main components setup to begin local development.**

---

## Troubleshooting tips

### Checklist for getting to a clean slate when dealing with issues

- pull latest from `main` and run the setup script from the root directory `./setup.ts`.
- Restart the node and redeploy contracts
- Delete `aggregator.sqlite` in `./aggregator`. This is the local DB which will get regenerated when the aggregator is started.
- Restart the aggregator and add the "-r" flag to the command e.g `./programs/aggregator.ts -r`.
- Reset the Quill extension in your browser if you're developing with Quill. You can do this by removing the extension and then re-adding via "Load unpacked" again. Or run `debug.reset();` twice in the background page console.

### Additional troubleshooting tips

- In general, the bundle or submission issues we've encountered have been us misconfiguring the data in the bundle or not configuring the aggregator properly.
- Be careful using Hardhat accounts 0 and 1 in your code when running a local aggregator. This is because the local aggregator config uses the same key pairs as Hardhat accounts 0 and 1 by default. You can get around this by not using accounts 0 and 1 elsewhere, or changing the default accounts that the aggregator uses locally.
- When packages are updated in the aggregator, you'll need to reload the deno cache as the setup script won't do this for you. You can do this with `deno cache -r deps.ts` in the `./aggregator` directory.
- If running Quill against a local node, and if you're using MetaMask to fund Quill, make sure the MetaMask 
localhost network  uses chainId `1337`.

### Tests

See each component's `README.md` for how to run tests.

## Testing/using updates to ./clients

### extension

```sh
cd ./contracts/clients
yarn build
yarn link
cd ../extension
yarn link bls-wallet-clients
```

If you would like live updates to from the clients package to trigger reloads of the extension, be sure to comment out this section of `./extension/weback.config.js`:

```javascript
...
module.exports = {
  ...
  watchOptions: {
    // Remove this if you want to watch for changes
    // from a linked package, such as bls-wallet-clients.
    ignored: /node_modules/,
  },
  ...
};
```

### aggregator

You will need to push up an `@experimental` version to 'bls-wallet-clients' on npm and update the version in `./aggregtor/src/deps.ts` until a local linking solution for deno is found. See https://github.com/alephjs/esm.sh/discussions/216 for details.
You will need write access to the npmjs project to do this. You can request access or request one of the BLS Wallet project developers push up your client changes in the `Discussions` section of this repo.

In `./contracts/clients` with your changes:

```sh
yarn publish-experimental
```

Note the `x.y.z-abc1234` version that was output.

Then in `./aggregtor/deps.ts`, change all `from` references for that package.

```typescript
...
} from "https://esm.sh/bls-wallet-clients@x.y.z-abc1234";
...
```
