# BLS Aggregate Signature Wallet

## Optimistic Rollups
"Currently every tx on OR puts an ECDSA signature on chain." - BWH

Simplification of Optimism's L2 solution:
![Optimistic Rollups](images/optimisticRollups.svg)

## Transactions via BLS signature aggregator
"We want to replace this with a BLS signature." - BWH

Proposed solution to make use of [BLS](https://github.com/thehubbleproject/hubble-contracts/blob/master/contracts/libs/BLS.sol) lib:
![BLS Batches](images/blsSigAggregation.svg)

# Dev/test

- Run the aggregation server (see `./server`).
- build and test contracts - `npx hardhat test`

### Optimism's L2
- clone https://github.com/ethereum-optimism/optimism-integration
- follow instructions (using latest version of docker)
- run script - `./up.sh`
    - L1 - http://localhost:9545
    - L2 - http://localhost:8545
- then in bls-wallet repo, can specify network - `npx hardhat <script> --network optimism`
