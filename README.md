![BLS Wallet](./docs/images/bls-github-banner.svg)

An Ethereum Layer 2 smart contract wallet that uses [BLS signatures](https://en.wikipedia.org/wiki/BLS_digital_signature) and aggregated transactions to reduce gas costs.

You can watch a full end-to-end demo of the project [here](https://www.youtube.com/watch?v=MOQ3sCLP56g)

## Getting Started

- [See an overview of BLS Wallet & how the components work together](./docs/system_overview.md)
- [Use BLS Wallet in a browser/NodeJS/Deno app](./docs/use_bls_wallet_clients.md)
- [Use BLS Wallet in your L2 dApp for cheaper, multi action transactions](./docs/use_bls_wallet_dapp.md)
- Setup the BLS Wallet components for:
  - [Local develeopment](./docs/local_development.md)
  - [Remote development](./docs/remote_development.md)

## Components

[contracts](./contracts/)

Solidity smart contracts for wallets, BLS signature verification, and deployment/testing tools.

[aggregator](./aggregator/)

Service which accepts BLS signed transactions and bundles them into one for submission.

[aggregator-proxy](./aggregator-proxy/)

npm package for proxying to another aggregator instance.

[bls-wallet-clients](./contracts/clients/)

npm package which provides easy to use constructs to interact with the contracts and aggregator.

[extension](./extension/)

Prototype browser extension used to manage BLS Wallets and sign transactions.


## Contract Deployments

See [./contracts/networks](./contracts/networks/) for a list of all contract deployment (network) manifests. Have an L2/rollup testnet you'd like BLS Wallet deployed on? [Open an issue](https://github.com/web3well/bls-wallet/issues/new) or [Deploy it yourself](./docs/remote_development.md)

- [Arbitrum Goerli](./contracts/networks/arbitrum-goerli.json)
- [Optimism Goerli](./contracts/networks/optimism-goerli.json)

## Ways to Contribute

- [Work on an open issue](https://github.com/web3well/bls-wallet/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)
- [Use BLS Wallet](./docs/use_bls_wallet_clients.md) in your project and [share it with us](https://github.com/web3well/bls-wallet/discussions)
- [Report a bug or request a feature](https://github.com/web3well/bls-wallet/issues/new)
- [Ask a question or answer an existing one](https://github.com/web3well/bls-wallet/discussions)
- [Try or add to our documentation](https://github.com/web3well/bls-wallet/tree/main/docs)

See our [contribution instructions & guidelines](./CONTRIBUTING.md) for more details.
