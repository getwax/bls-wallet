# BLS Provider

This document will show you how to interact with the `BlsProvider` and `BlsSigner` classes.

The `BlsProvider` and `BlsSigner` are part of the `bls-wallet-clients` npm package, and help you interact with BLS Wallet components in a similar way you would use an Ethers provider and signer to interact with the Ethereum ecosystem. It offers developers a familiar develoment experience, while providing access to BLS Wallet components and features. Essentially it's a Ethers provider-shaped wrapper around `bls-wallet-clients`.

The `BlsProvider` and `BlsSigner` mimic the behaviour of an Ethers [JsonRpcProvider](https://docs.ethers.org/v5/api/providers/jsonrpc-provider/) and [JsonRpcSigner](https://docs.ethers.org/v5/api/providers/jsonrpc-provider/#JsonRpcSigner) respectively. In this implementation, note that the `BlsSigner` has knowledge of its own private key. For more information on Ethers providers and signers, visit the [Ethers v5 docs](https://docs.ethers.org/v5/).

The `BlsProvider` and `BlsSigner` are covered by over 100 test cases, including integration tests. If any functionality is not documented here, it will likely be documented by test cases.

# Creating instances

## BlsProvider

### Instantiating a BlsProvider

```ts
import { Experimental } from "bls-wallet-clients";

const aggregatorUrl = "http://localhost:3000";
const verificationGateway = "0x123";
const aggregatorUtilities = "0x321";
const rpcUrl = "http://localhost:8545";
const network = {
    name: "localhost",
    chainId: 0x539, // 1337
};

const provider = new Experimental.BlsProvider(
    aggregatorUrl,
    verificationGateway,
    aggregatorUtilities,
    rpcUrl,
    network
);
```

### BlsSigner

**Important:** Ensure that the BLS wallet you are linking the `BlsSigner` to via the private key is funded. Alternatively, if a wallet doesn't yet exist, it will be lazily created on the first transaction. In this scenario, you can create a random BLS private key with the following helper method and fund that account. It will need to be funded in order to send its first transaction.

```ts
import { Experimental } from "bls-wallet-clients";

const privateKey = await Experimental.BlsSigner.getRandomBlsPrivateKey();

const signer = provider.getSigner(privateKey);

// Send funds to this address if the wallet does not exist
const address = await signer.getAddress();
```

### Instantiating a BlsSigner

```ts
// 32 random bytes
const privateKey =
    "0x0001020304050607080910111213141516171819202122232425262728293031";

const signer = provider.getSigner(privateKey);
```

# Send ETH

### Send ETH via BlsSigner

```ts
const transactionResponse = await signer.sendTransaction({
    to: recipient,
    value: amountToTransfer,
});
const transactionReceipt = await transactionResponse.wait();
```

### Send ETH via BlsProvider

```ts
// Note the transaction must be signed via the BlsSigner first
const signedTransaction = await signer.signTransaction({
    to: recipient,
    value: amountToTransfer,
});

const transactionResponse = await provider.sendTransaction(signedTransaction);
const transactionReceipt = await transactionResponse.wait();
```

# Get a transaction receipt via a transaction hash

This will return a transaction receipt that corresponds to a transaction and transaction hash that can be quired on a block explorer.

```ts
const transactionReceipt = await provider.getTransactionReceipt(
    transactionResponse.hash
);
```

# Multi-action transactions

### Send multi-action transactions with BlsSigner

```ts
// using BlsSigner
const transactionBatchResponse = await signer.sendTransactionBatch(
    {
        to: recipient1,
        value: amountToTransfer,
    },
    {
        to: recipient2,
        value: amountToTransfer,
    }
);
const transactionReceipt = await transactionBatchResponse.awaitBatchReceipt();
```

### Send multi-action transactions with BlsProvider

```ts
// Note the transaction must be signed via the BlsSigner first
const signedTransactionBatch = await signer.signTransactionBatch(
    {
        to: recipient1,
        value: amountToTransfer,
    },
    {
        to: recipient2,
        value: amountToTransfer,
    }
);

const transactionBatchResponse = await provider.sendTransactionBatch(
    signedTransactionBatch
);
const transactionReceipt = await transactionBatchResponse.awaitBatchReceipt();
```

# Interacting with smart contracts

### Interacting with a deployed smart contract

```ts
const ERC20 = new ethers.Contract(tokenAddress, tokenInterface, signer);

const transaction = await ERC20.transfer(recipient, amountToTransfer);
await transaction.wait();
```

### Interacting with a smart contract that hasn't been deployed

**Important:** You cannot deploy contracts with a BLS Wallet. Use a funded EOA for deploying
contracts instead. Then make sure you connect to the contract instance with your `BlsSigner`.
Contract deployments via a BLS Wallet is a feature tabled for our V2 contracts.

```ts
// Deploying contracts must be done by a non-BLS Wallet account
const nonBLSWalletAccount = new ethers.Wallet(fundedWalletPrivateKey, provider);

const ERC20 = await ethers.getContractFactory("ERC20");
const erc20 = await ERC20.connect(nonBLSWalletAccount).deploy(
    tokenName,
    tokenSymbol,
    tokenSupply
);
await erc20.deployed();

const signer = provider.getSigner(privateKey);

const transaction = await erc20
    .connect(signer)
    .transfer(recipient, amountToTransfer);
await transaction.wait();
```

### Multi-action contract interactions

```ts
// Working example of this setup can be found in BlsSignerContractInteraction.test.ts
const transactionBatch = {
    transactions: [
        {
            to: ERC20.address,
            value: 0,
            data: ERC20.interface.encodeFunctionData("approve", [
                spender,
                amountToTransfer,
            ]),
        },
        {
            to: spender,
            value: 0,
            data: mockTokenSpender.interface.encodeFunctionData(
                "TransferERC20ToSelf",
                [ERC20.address, amountToTransfer]
            ),
        },
    ],
};

const result = await signer.sendTransactionBatch(transactionBatch);
await result.awaitBatchReceipt();
```

# Estimating gas for a transaction

The `BlsProvider` adds a small safety premium to the gas estimate to improve the likelyhood a bundle gets included during aggregation. If you'd like more fined grained control over the fee, you use the [helper method](../contracts//clients/README.md#estimating-and-paying-fees) from the `bls-wallet-clients` package directly instead.

### Estimating gas with BlsProvider

```ts
const fee = await provider.estimateGas({
    to: recipient,
    value: amountToTransfer,
});
```

### Estimating gas when interacting with a contract

```ts
const feeEstimate = await ERC20.estimateGas.transfer(
    recipient,
    amountToTransfer
);
```
