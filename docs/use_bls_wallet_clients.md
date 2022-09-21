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

## Import

```typescript
import { providers } from "ethers";
import { Aggregator, BlsWalletWrapper, getConfig } from "bls-wallet-clients";
```

### Deno

You can use [esm.sh](https://esm.sh/) or a similar service to get Deno compatible modules.

```typescript
import { providers } from "https://esm.sh/ethers@latest";
import { Aggregator, BlsWalletWrapper, getConfig } from "https://esm.sh/bls-wallet-clients@latest";
```

## Get Deployed Contract Addresses

You can find current contract deployments in the [contracts networks folder](../contracts/networks/).
If you would like to deploy locally, see [Local development](./local_development.md).
If you would like to deploy to a remote network, see [Remote development](./remote_development.md).

## Send a transaction

```typescript
import { readFile } from 'fs/promises';

// import fetch from 'node-fetch'; // Add this if using nodejs<18
import { ethers, providers } from 'ethers';
import { Aggregator, BlsWalletWrapper, getConfig } from 'bls-wallet-clients';

// globalThis.fetch = fetch; // Add this if using nodejs<18

// Instantiate a provider via browser extension, such as Metamask 
// const provider = new providers.Web3Provider(window.ethereum);
// Or via RPC
const provider = new providers.JsonRpcProvider('https://goerli-rollup.arbitrum.io/rpc');
// See https://docs.ethers.io/v5/getting-started/ for more options

// Get the deployed contract addresses for the network.
// Here, we will get the Arbitrum testnet.
// See local_development.md for deploying locally and
// remote_development.md for deploying to a remote network.
const netCfg = await getConfig(
  '../contracts/networks/arbitrum-goerli.json',
  async (path) => readFile(path),
);

// 32 random bytes
const privateKey = '0x0001020304050607080910111213141516171819202122232425262728293031';

// Note that if a wallet doesn't yet exist, it will be
// lazily created on the first transaction.
const wallet = await BlsWalletWrapper.connect(
  privateKey,
  netCfg.addresses.verificationGateway,
  provider
);

const erc20Address = netCfg.addresses.testToken; // Or some other ERC20 token
const erc20Abi = [
    'function mint(address to, uint amount) returns (bool)',
];
const erc20 = new ethers.Contract(erc20Address, erc20Abi, provider);

console.log('Contract wallet:', wallet.address);
console.log('Test token:', erc20.address);

const nonce = await wallet.Nonce();
// All of the actions in a bundle are atomic, if one
// action fails they will all fail.
const bundle = wallet.sign({
  nonce,
  actions: [
    {
      // Mint ourselves one test token
      ethValue: 0,
      contractAddress: erc20.address,
      encodedFunction: erc20.interface.encodeFunctionData(
        'mint',
        [wallet.address, ethers.utils.parseUnits('1', 18)],
      ),
    },
  ],
});

const aggregator = new Aggregator('https://arbitrum-goerli.blswallet.org');

console.log('Sending bundle to the aggregator');
const addResult = await aggregator.add(bundle);

if ('failures' in addResult) {
  throw addResult.failures.join('\n');
}

console.log('Bundle hash:', addResult.hash);

const checkConfirmation = async () => {
  console.log('Checking for confirmation')
  const maybeReceipt = await aggregator.lookupReceipt(addResult.hash);

  if (maybeReceipt === undefined) {
    return;
  }

  console.log('Confirmed in block', maybeReceipt.blockNumber);
  provider.off('block', checkConfirmation);
};

provider.on('block', checkConfirmation);
```

## More

See [clients](../contracts/clients/) for additional functionality.
