# BLS Wallet Clients

[![npm version](https://img.shields.io/npm/v/bls-wallet-clients)](https://www.npmjs.com/package/bls-wallet-clients)

_Client libraries for interacting with BLS Wallet components_

## Network Config

Deployed contract addresses and metadata.

```ts
import { NetworkConfig, getConfig } from 'bls-wallet-clients';

const netCfg: NetworkConfig = await getConfig(
  '/path/to/network/config',
  async (path) => ... /* fetch, fs.readFile, etc. */
);
// Read from netCfg.addresses.verificationGateway, etc.
```

## Aggregator

Exposes typed functions for interacting with the Aggregator's HTTP API.

### Add a bundle to an aggregator

```ts
import { Aggregator } from "bls-wallet-clients";

const aggregator = new Aggregator("https://arbitrum-goerli.blswallet.org");
const resp = await aggregator.add(bundle); // See BlsWalletWrapper section below
// Aggregator did not accept bundle
if ("failures" in resp) {
  throw new Error(resp.failures.join(", "));
}
```

### Get the bundle receipt that contains the transaction hash you can lookup on a block explorer

You will have to poll for the bundle receipt once you have added a bundle to an aggregator. The transaction hash is located on the bundle receipt. The property you need is `bundleReceipt.transactionHash`. This represents the transaction hash for the bundle submitted to the Verification Gatewaty, and can be used in a block explorer.

Note this transaction is reprentative of the entire bundle submitted by the aggregator, and does not represent individual operations. To retrieve information about individual operations, use the get `getOperationResults` helper method which is explained under the [VerificationGateway](#verificationgateway) section below.

```ts
import { Aggregator } from "bls-wallet-clients";

const aggregator = new Aggregator("https://arbitrum-goerli.blswallet.org");
const resp = await aggregator.add(bundle); // See BlsWalletWrapper section below
// Aggregator did not accept bundle
if ("failures" in resp) {
  throw new Error(resp.failures.join(", "));
}

let receipt;
while (!receipt) {
  receipt = await aggregator.lookupReceipt(resp.hash);
  // There was an issue submitting the bundle on chain
  if (receipt && "submitError" in receipt) {
    throw new Error(receipt.submitError);
  }
  // Some function which waits i.e. setTimeout
  await sleep(5000);
}
```

## BlsWalletWrapper

Wraps a BLS wallet, storing the private key and providing `.sign(...)` to
produce a `Bundle`, that can be used with `aggregator.add(...)`. Make sure the bls wallet you're trying to use has enough ETH to send transactions. You can either fund a wallet before it's created, or after the wallet is lazily created from its first transaction (bundle).

```ts
import { BlsWalletWrapper } from "bls-wallet-clients";

const wallet = await BlsWalletWrapper.connect(
  privateKey,
  verificationGatewayAddress,
  provider,
);

const bundle = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [
    {
      ethValue: 0,
      contractAddress: someToken.address, // An ethers.Contract
      encodedFunction: someToken.interface.encodeFunctionData("transfer", [
        "0x...some address...",
        ethers.BigNumber.from(1).pow(18),
      ]),
    },
    // Additional actions can go here. When using multiple actions, they'll
    // either all succeed or all fail.
  ],
});

await aggregator.add(bundle);
```

### Sending a regular ETH transaction

```ts
// Follow the same steps as the first BlsWalletWrapper example, but construct the bundle actions like so:
const amountToTransfer = ethers.utils.parseUnits("1");
const reciever = "0x1234...";

const bundle = wallet.sign({
  nonce,
  actions: [
    {
      ethValue: amountToTransfer, // amount of ETH you want to transfer
      contractAddress: reciever, // receiver address. Can be a contract address or an EOA
      encodedFunction: "0x", // leave this as "0x" when just sending ETH
    },
  ],
});
```

### Constructing actions to be agnostic to both ETH transfers and contract interactions

```ts
// Follow the same steps as the first BlsWalletWrapper example, but construct the bundle actions like so:
const transactions = [
  {
    value: ethers.utils.parseUnits("1"), // amount of ETH you want to transfer
    to: "0x1234...", // to address. Can be a contract address or an EOA
  },
];

const actions: ActionData[] = transactions.map((tx) => ({
  ethValue: tx.value ?? "0",
  contractAddress: tx.to,
  encodedFunction: tx.data ?? "0x", // in this example, there is no data property on the tx object, so "0x" will be used
}));

const bundle = wallet.sign({
  nonce,
  actions,
});
```

## Estimating and paying fees

User bundles must pay fees to compensate the aggregator. Fees can be paid by adding an additional action to the users bundle that pays tx.origin. For more info on how fees work, see [aggregator fees](../../aggregator/README.md#fees).

Practically, this means you have to first estimate the fee using `aggregator.estimateFee`, and then add an additional action to a user bundle that pays the aggregator with the amount returned from `estimateFee`. When estimating a payment, you should include this additional action with a payment of zero, otherwise the additional action will increase the fee that needs to be paid. Additionally, the `feeRequired` value returned from `estimateFee` is the absolute minimum fee required at the time of estimation, therefore, you should pay slightly extra to ensure the bundle has a good chance of being submitted successfully.

### Paying aggregator fees with native currency (ETH)

```ts
import { BlsWalletWrapper, Aggregator } from "bls-wallet-clients";

const wallet = await BlsWalletWrapper.connect(
  privateKey,
  verificationGatewayAddress,
  provider,
);
const aggregator = new Aggregator("https://arbitrum-goerli.blswallet.org");

// Create a fee estimate bundle
const estimateFeeBundle = wallet.sign({
  nonce,
  actions: [
    ...actions, // ... add your user actions here (approve, transfer, etc.)
    {
      ethValue: 1,
      // Provide 1 wei with this action so that the fee transfer to
      // tx.origin can be included in the gas estimate.
      contractAddress: aggregatorUtilitiesContract.address,
      encodedFunction:
        aggregatorUtilitiesContract.interface.encodeFunctionData(
          "sendEthToTxOrigin",
        ),
    },
  ],
});

const feeEstimate = await aggregator.estimateFee(estimateFeeBundle);

// Add a safety premium to the fee to account for fluctuations in gas estimation
const safetyDivisor = 5;
const feeRequired = BigNumber.from(feeEstimate.feeRequired);
const safetyPremium = feeRequired.div(safetyDivisor);
const safeFee = feeRequired.add(safetyPremium);

const bundle = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [
    ...actions, // ... add your user actions here (approve, transfer, etc.)
    {
      ethValue: safeFee, // fee amount
      contractAddress: aggregatorUtilitiesContract.address,
      encodedFunction:
        aggregatorUtilitiesContract.interface.encodeFunctionData(
          "sendEthToTxOrigin",
        ),
    },
  ],
});
```

Since the aggregator detects that fees have been paid by observing the effect of a bundle on its own balance, you can also tranfer the required fee directly to the aggregator. Following the same example as above, you can add an action that transfers the fee amount to the aggregator address, instead of the action that calls sendEthToTxOrigin. Ensure you modify the estimateFeeBundle to use this action instead.

```ts
const bundle = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [
    ...actions, // ... add your user actions here (approve, transfer, etc.)
    {
      ethValue: safeFee, // fee amount
      contractAddress: aggregatorAddress,
    },
  ],
});
```

### Paying aggregator fees with custom currency (ERC20)

The aggregator must be set up to accept ERC20 tokens in order for this to work.

```ts
import { BlsWalletWrapper, Aggregator } from "bls-wallet-clients";

const wallet = await BlsWalletWrapper.connect(
  privateKey,
  verificationGatewayAddress,
  provider,
);
const aggregator = new Aggregator("https://arbitrum-goerli.blswallet.org");

// Create a fee estimate bundle
const estimateFeeBundle = wallet.sign({
  nonce,
  actions: [
    ...actions, // ... add your user actions here (approve, transfer, etc.)
    {
      ethValue: 0,
      contractAddress: tokenContract.address,
      encodedFunction: tokenContract.interface.encodeFunctionData("approve", [
        aggregatorUtilitiesContract.address,
        1,
      ]),
    },
    {
      ethValue: 0,
      contractAddress: aggregatorUtilitiesContract.address,
      encodedFunction: aggregatorUtilitiesContract.interface.encodeFunctionData(
        "sendTokenToTxOrigin",
        [tokenContract.address, 1],
      ),
    },
  ],
});

const feeEstimate = await aggregator.estimateFee(estimateFeeBundle);

// Add a safety premium to the fee to account for fluctuations in gas estimation
const safetyDivisor = 5;
const feeRequired = BigNumber.from(feeEstimate.feeRequired);
const safetyPremium = feeRequired.div(safetyDivisor);
const safeFee = feeRequired.add(safetyPremium);

const bundle = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [
    ...actions, // ... add your user actions here (approve, transfer, etc.)

    // Note the additional approve action when transfering ERC20 tokens
    {
      ethValue: 0,
      contractAddress: tokenContract.address,
      encodedFunction: tokenContract.interface.encodeFunctionData("approve", [
        aggregatorUtilitiesContract.address,
        safeFee, // fee amount
      ]),
    },
    {
      ethValue: 0,
      contractAddress: aggregatorUtilitiesContract.address,
      encodedFunction: aggregatorUtilitiesContract.interface.encodeFunctionData(
        "sendTokenToTxOrigin",
        [
          tokenContract.address,
          safeFee, // fee amount
        ],
      ),
    },
  ],
});
```

Since the aggregator detects that fees have been paid by observing the effect of a bundle on its own balance, you can also tranfer the required fee directly to the aggregator. Following the same example as above, you can add an action that transfers the fee amount to the aggregator address, instead of the action that calls sendEthToTxOrigin. Ensure you modify the estimateFeeBundle to use this action instead.

```ts
const bundle = wallet.sign({
  nonce: await wallet.Nonce(),
  actions: [
    ...actions, // ... add your user actions here (approve, transfer, etc.)
    {
      ethValue: 0,
      contractAddress: tokenContract.address,
      encodedFunction: tokenContract.interface.encodeFunctionData("transfer", [
        aggregatorAddress,
        safeFee, // fee amount
      ]),
    },
  ],
});
```

## VerificationGateway

Exposes `VerificationGateway` and `VerificationGateway__factory` generated by
[typechain](https://github.com/dethcrypto/TypeChain) to enable typed
interactions with the `VerificationGateway`.

```ts
import { VerificationGateway__factory } from "bls-wallet-clients";

const verificationGateway = VerificationGateway__factory.connect(
  verificationGatewayAddress,
  signer, // An ethers signer
);

await verificationGateway.processBundle(bundle);
```

You can get the results of the operations in a bundle using `getOperationResults`.

```ts
import { getOperationResults, decodeError } from 'bls-wallet-clients';

...

const txn = await verificationGateway.processBundle(bundle);
const txnReceipt = txn.wait();
const opResults = getOperationResults(txnReceipt);

// Includes data from WalletOperationProcessed event,
// as well as parsed errors with action index
const { error } = opResults[0];
console.log(error?.actionIndex); // ex. 0 (as BigNumber)
console.log(error?.message); // ex. "some require failure message"

// If you want more granular ability to decode an error message
// you can use the decodeError function.
const errorData = '0x5c66760100000000.............000000000000';
const opResultError = decodeError(errorData);
console.log(opResultError.actionIndex); // ex. 0 (as BigNumber)
console.log(opResultError.message); // ex. "ERC20: insufficient allowance"
```

## Signer

Utilities for signing, aggregating and verifying transaction bundles using the
bls signature scheme. Bundles are actioned in
[contracts](https://github.com/jzaki/bls-wallet/tree/main/contracts).

Useful in the [aggregator](https://github.com/jzaki/bls-wallet/tree/main/aggregator)
for verification and aggregation, and in the
[extension](https://github.com/jzaki/bls-wallet/tree/main/extension) for signing
and aggregation.

```ts
import ethers from "ethers";
import { initBlsWalletSigner } from "bls-wallet-clients";

(async () => {
  const signer = await initBlsWalletSigner({ chainId: 10 });

  const privateKey = "0x...256 bits of private hex data here";

  const someToken = new ethers.Contract(
    ...
    // See https://docs.ethers.io/v5/getting-started/
  );

  const bundle = signer.sign(
    {
      nonce: ethers.BigNumber.from(0),
      ethValue: ethers.BigNumber.from(0),
      contractAddress: someToken.address,

      // If you don't want to call a function and just send `ethValue` above,
      // use '0x' to signify an empty byte array here
      encodedFunction: someToken.interface.encodeFunctionData("transfer", [
        "0x...some address...",
        ethers.BigNumber.from(10).pow(18),
      ]),
    },
    privateKey,
  );

  // Send bundle to an aggregator or use it with VerificationGateway directly.
})();
```

## Local Development

### Setup

```sh
yarn install
```

### Build

```sh
yarn build
```

### Tests

```sh
yarn test
```

### Use in Extension or another project

```sh
yarn build
yarn link
cd other/project/dir
yarn "link bls-wallet-clients"
```

## Troubleshooting tips

- Make sure your bls-wallet-clients package is up-to-date and check out our [releases page](https://github.com/web3well/bls-wallet/releases) for info on breaking changes.
- Check network values such as the verification gateway address or the aggregator url are up-to-date. The most up-to-date values are located in the relevant [network config](./../contracts/networks) file. If you're deploying to a custom network, you'll have to check these against your own records as these won't be in the network directory.
