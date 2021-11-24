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

## Signer

TODO: Updates... this is just copied from the previous signer module

# BLS Wallet Signer

Typescript module for signing, aggregating and verifying transactions using the bls signature scheme. Signed transactions are actioned in [bls-wallet-contracts](https://github.com/jzaki/bls-wallet-contracts).
Useful in the [aggregator](https://github.com/jzaki/bls-wallet-aggregator) for verification and aggregation, and in the [plugin](https://github.com/jzaki/bls-wallet-plugin) for signing and aggregation.

```sh
npm install bls-wallet-signer
```

## Usage

```ts
import ethers from "ethers";
import { initBlsWalletSigner } from "bls-wallet-signer";

(async () => {
  const signer = await initBlsWalletSigner({ chainId: 10 });

  const privateKey = "0x...256 bits of private hex data here";

  const someToken = new ethers.Contract(
    // See https://docs.ethers.io/v5/getting-started/
  );

  const signedTransactionData = signer.sign(
    {
      nonce: ethers.BigNumber.from(0),
      ethValue: ethers.BigNumber.from(0),
      contractAddress: someToken.address,

      // If you don't want to call a function and just send `ethValue` above,
      // use '0x' to signify an empty byte array here
      encodedFunction: someToken.interface.encodeFunctionData(
        "transfer",
        ["0x...some address...", ethers.BigNumber.from(10).pow(18)],
      ),
    },
    privateKey,
  );

  // Send signedTransactionData to an aggregator or use it with
  // VerificationGateway directly.
})();
```
