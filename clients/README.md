# BLS Wallet Clients

*Client libraries for interacting with BLS Wallet components*

## Aggregator

Exposes typed functions for interacting with the Aggregator's HTTP api.

```ts
const aggregator = new Aggregator('https://rinkarby.blswallet.org');

await aggregator.addTransaction(...);
```

## BlsWallet

Models a BLS wallet, storing the private key and providing `.sign(...)` to
produce `TransactionData`, that can be used with
`aggregator.addTransaction(...)`.

```ts
const wallet = await BlsWallet.connectOrCreate(
  privateKey,
  verificationGatewayAddress,
  parentWallet, // A regular ethers wallet
);

const tx = wallet.sign({
  contract: someToken, // An ethers.Contract
  method: 'transfer',
  args: [recipientAddress, ethers.utils.parseUnits('1', 18)],
  nonce: await wallet.Nonce(),
});

await aggregator.addTransaction(tx);
```

## VerificationGateway

Wraps an `ethers.Contract` with a typed interface for `VerificationGateway`.
Allows sending transactions without relying on an aggregator.

```ts
import { initBlsWalletSigner } from 'bls-wallet-signer';

const blsWalletSigner = await initBlsWalletSigner({
  chainId: 1,
});

const verificationGateway = new VerificationGateway(
  verificationGatewayAddress,
  regularWallet, // An ethers.Wallet
);

await verificationGateway.actionCalls(
  ethers.constants.AddressZero,
  blsWalletSigner.aggregate([tx]),
);
```
