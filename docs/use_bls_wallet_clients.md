# Use BLS Wallet Client

This walkthrough will show you how to submit an ERC20 transfer to the BLS Wallet Aggregator.

## Add bls-wallet-clients

```sh
# npm
npm install bls-wallet-clients
# yarn
yarn add bls-wallet-clients
# deno in example further below
```

You will also need to have [ethers](https://docs.ethers.io) installed.

## Import

```typescript
import { providers } from "ethers";
import { Aggregator, BLSWalletWrapper, getConfig } from "bls-wallet-clients";
```

### Deno

You can use [esm.sh](https://esm.sh/) or a similar service to get Deno compatible modules.

```typescript
import { providers } from "https://esm.sh/ethers@latest";
import { Aggregator, BLSWalletWrapper, getConfig } from "https://esm.sh/bls-wallet-clients@latest";
```

## Get Deployed Contract Addresses

You can find current contract deployments in the [contracts networks folder](../contracts/networks/).
If you would like to deploy locally, see [Local development](./local_development.md).
If you would like to deploy to a remote network, see [Remote development](./remote_development.md).

## Send a transaction

```typescript
import { readFile } from "fs/promises";


// Instantiate a provider via browser extension, such as Metamask 
const provider = providers.Web3Provider(window.ethereum);
// Or via RPC
const provider = providers.JsonRpcProvider();
// See https://docs.ethers.io/v5/getting-started/ for more options

// Get the deployed contract addresses for the network.
// Here, we will get the Arbitrum testnet.
// See local_development.md for deploying locally and
// remote_development.md for deploying to a remote network.
const netCfg = await getConfig("../contracts/networks/arbitrum-testnet.json", async (path) => readFile(path));

const privateKey = "0x...";

// Note that if a wallet doesn't yet exist, it will be
// lazily created on the first transaction.
const wallet = await BlsWallerWrapper.connect(
  privateKey,
  netCfg.contracts.verificationGateway,
  provider
);

const erc20Address = "0x...";
const erc20Abi = [
    "function transfer(address to, uint amount) returns (bool)",
];
const erc20 = new ethers.Contract(erc20Address, erc20Abi, provider);

const recipientAddress = "0x...";
const nonce = await wallet.Nonce();
// All of the actions in a bundle are atomic, if one
// action fails they will all fail.
const bundle = wallet.sign({
  nonce,
  actions: [
    {
      contract: erc20,
      method: "transfer",
      args: [recipientAddress, ethers.utils.parseUnits("1", 18)],
    },

  ],
});

const aggregator = new Aggregator("https://rinkarby.blswallet.org");
await aggregator.add(bundle);
```

## More

See [clients](../contracts/clients/) for additional functionality.
