# BLS Wallet Clients

*Client libraries for interacting with BLS Wallet components*

## Aggregator

Exposes typed functions for interacting with the Aggregator's HTTP api.

```ts
import { Aggregator } from 'bls-wallet-clients';

const aggregator = new Aggregator('https://rinkarby.blswallet.org');

await aggregator.addTransaction(...);
```

## BlsWallet

Models a BLS wallet, storing the private key and providing `.sign(...)` to
produce `Transaction`, that can be used with `aggregator.addTransaction(...)`.

```ts
import { BlsWallet } from 'bls-wallet-clients';

const wallet = await BlsWallet.connect(
  privateKey,
  verificationGatewayAddress,
  provider,
);

const tx = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [
    {
      contract: someToken, // An ethers.Contract
      method: 'transfer',
      args: [recipientAddress, ethers.utils.parseUnits('1', 18)],
    },
    // Additional actions can go here. When using multiple actions, they'll
    // either all succeed or all fail.
  ],
});

await aggregator.addTransaction(tx);
```

## VerificationGateway

Wraps an `ethers.Contract` with a typed interface for `VerificationGateway`.
Allows sending transactions without relying on an aggregator.

```ts
import { VerificationGateway } from 'bls-wallet-clients';
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
