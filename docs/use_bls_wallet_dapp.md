# Use BLS Wallet In Your L2 dApp

This guide will show you how to use BLS Wallet in your L2 dApp (Layer 2 decentralized application) so you can utilize multi-action transactions.

## Download, Install, & Setup Quill

[Quill](../extension/) is a protoype browser extension wallet which intergrates [bls-wallet-clients](../contracts/clients/) to communicate with the BLS Wallet smart contracts & transaction aggregator. It supports most of the functionality in [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193).

Currently, we have the contracts deployed to the networks/chains listed [here](https://github.com/web3well/bls-wallet/tree/main/contracts/networks). If your desired network isn't there, you can use the [Remote Development](./remote_development.md) contract deployment intrsuctions or request a network deploy by [opening an issue](https://github.com/web3well/bls-wallet/issues/new) or [starting a discussion](https://github.com/web3well/bls-wallet/discussions/new).

Below are the instructions for 2 ways you can add Quill to your browser.

### Prebuilt

Go to the [releases page](https://github.com/web3well/bls-wallet/releases) and scroll down to the latest release. In the `Assets` section, download the extension for either Chrome, Firefox, or Opera. To install, simply drag and drop the file into your browser on the extensions page or follow instructions for installing extensions from a file for your browser.

### From Repo

Follow the instructions in either [Local Development](./local_development.md) or [Remote Development](./remote_development.md) to setup this repo and install Quill.

### Setup Quill

After installing the extension, Quill will auto-open and guide you through the setup process.

## Connect Your dApp to Quill

Next, connect your dApp to Quill just like you would any other extension wallet.

`ethers.js`
```typescript
import { providers } from 'ethers';

const provider = new providers.Web3Provider(window.ethereum);

await window.ethereum.request({ method: "eth_accounts" });
```

Or similarly with [web3modal](https://github.com/WalletConnect/web3modal#usage) or [rainbow-connect](https://rainbowkit.vercel.app/docs/installation#configure)

## Send Multi-Action Transaction

Finally, you can populate & send your multi-action transaction. In the following example, we will do an approve & swap with a DEX (decentralized exchange) in one transaction.

### Check that window.ethereum Supports Multi-Action Transactions

Since any browser extension wallet could be used, make sure that it is Quill before allowing a multi-action transaction.

```typescript
const areMultiActionTransactionSupported = !!window.ethereum.isQuill;
// Branch here depending on the result
if (areMultiActionTransactionSupported) {
  ...
}
```

### Populate the Transactions (Actions)

First, we will populate the transactions (actions) we want to send.

```typescript
// Get the signer and connect to the contracts.
//
// If you want the contracts to always have write access
// for a specific account, pass the signer in as the
// provider instead and skip calling connect on them.
const signer = provider.getSigner();

const erc20Contract = new ethers.Contract(erc20Address, erc20Abi, provider);
const dexContract = new ethers.Contract(dexAddress, dex20Abi, provider);

// Populate the token approval transaction.
const approveTransaction = await erc20Contract
  .connect(signer)
  .populateTransaction.approve(dexAddress, amount);

// Populate the token swap transaction.
const swapTransaction = await dexContract
  .connect(signer)
  .populateTransaction.swap(erc20Address, amount, otherERC20Address);
```

### Send the Transaction

Then, send the populated transactions.

Quill's [eth_sendTransaction](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendtransaction) accepts a modified `params` property into which more than one transaction object can be passed in. [Make sure window.ethereum can accept multiple transactions](#check-that-windowethereum-supports-multi-action-transactions) before passing more than one in.

```typescript
const transactionHash = await window.ethereum.request({
  method: "eth_sendTransaction",
  params: [approveTransaction, swapTransaction],
});

const transactionReceipt = await provider.getTransactionReceipt(transactionHash);
// Do anything else you need to with the transaction receipt.
```

You also can still send normal one-off transactions as you normally would, and still get the gas saving benefits of having your transaction aggregated with other transactions.

```typescript
const transferTransaction = await erc20Contract
  .connect(signer)
  .approve(otherAddress, amount);

await transferTransaction.wait();
```

## How Does This All Work?

See the [System Overview](./system_overview.md) for more details on what's happening behind the scenes.

## Example dApps Which Use BLS Wallet

- https://github.com/kautukkundan/BLSWallet-ERC20-demo 
- https://github.com/voltrevo/bls-wallet-billboard

## Coming soon

- Gasless transaction example.
