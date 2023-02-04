# Quill - easy, fast, and low-cost Ethereum transactions

## Overview

Interaction with web3 applications can be slow, costly, and risky.
**Quill** leverages BLS signature aggregation on Ethereum layer 2 solutions, easily bringing fast and low-cost Ethereum transactions to your browser.

### Additional Benefits

- send multiple txs as one to ensure atomic execution
- pay even less gas by reducing on chain footprint of signatures

### How to use it

1. install the plugin
2. create a contract wallet (uses bls keys)
3. transfer L2 erc20 tokens
4. use contract wallet with L2 dapps (coming soon)

## Feature Summary

### MVP (uses Optimism)

- Chrome/Brave plugin
- Secure storage of BLS private-keys
- Sign tx data:
  - wallet creation
  - erc20 transfers
- Submit txs to hosted [aggregator](https://github.com/jzaki/bls-wallet-aggregator)
- Basic feedback from aggregator for UI updates (tx received, tx mined. tx dropped?)

### Upcoming

- Secure storage of EDDSA and ECDSA keys
- Social recovery
  - nominate guardians
  - recover contract wallet
- Receive tx data from existing L2 dapps on networks:
  - Optimism
  - Arbitrum (coming soon)
  - ...
- Receive and review multiple txs from dapps
  - sign all and submit to aggregator
- Wallet feedback (from L2 sequencer)
  - listening to wallet events
  - wallet tx history

### Future

- Sign and submit multiple transactions as one (to L2 sequencer)
  - local signature aggregation
- Review and sign typed data (712)

## Requirements

### Secure storage

- Safe storage options for extension

### BLS components

- signing transactions
- signature verification
- signature aggregation

### Servers

- Aggregator
- Future: L2 Sequencer

### User Interface Base

- Extension for Chrome/Brave and Firefox
  - Web Extensions? combined extensions standard
- [storyboard](https://drive.protonmail.com/urls/J7EECNCGS0#2xqYOqlIzeaB)
- Common:
  - Network name (hover chainId)
  - Current BLS Key (option to create)
  - Associated contract wallet address if any (option to create)
  - contract wallet balance (L2 ETH token)
  - Action to Transfer (starts tx data)
- tx edit section:
  - Method name "transfer" (show methodId)
  - Params as text fields
    - address with checks (length, checksum)
    - balance as decimal (\*10^18)
- signed tx section:
  - signed txs per row
    - method name - nonce - (send)
  - (aggregate) - (send all)

## Development

To run the dev server:

```sh
yarn run dev:chrome # or dev:firefox etc, see scripts in package.json
```
