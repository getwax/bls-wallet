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

      // This is a reward that goes to the aggregator for performing aggregation
      // and paying your transaction fee. It doesn't need to be the same token
      // as the one we're transferring. It may be any token, subject only to
      // whatever acceptance criteria the aggregator may define.
      rewardTokenAddress: someToken.address,
      rewardTokenAmount: ethers.BigNumber.from(10).pow(9),

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
