# Arbitrum Gas Costs

This file compares the gas costs between one BLS transaction to BLSExpander.blsCallMultiSameCallerContractFunction 
and multiple regular ERC20 token transfers. If 31 transfers are aggregated inside one BLS transaction, then a comparison
will be made between that one BLS transaction and 31 normal token transfers.

### Table Fields:
* Commit - git commit the gas results were computed for
* Tx Type - "BLS" for BLS aggregated transactions or "Normal" for normal token transfers
* Number Txs - Number of transactions aggregated in one BLS transaction
* Units - Units may vary slightly from run to run, but should remain close to constant if the bls-wallet implementation stays the same.
  * L1 Calldata Units Used - number of calldata units stored on L1 for the transaction(s)
  * L1 Transaction Units - number of distinct transactions (always 1 for BLS transactions)
  * L2 Computation Units - number of computation units used on L2
  * L2 Storage Units - number of L2 storage units used
* Cost - All costs are denominated in ETH according to current Arbitrum mainnet prices
  * L1 Calldata Cost - Cost of the transaction due to storing calldata on L1
  * L2 Tx Cost - Cost of sending the transactions (the more transactions sent, the higher this cost) 
  * L2 Storage Cost - Cost of storing data in L2
  * L2 Computation Cost - Cost of computation on L2
  * Total Cost - Total cost of either the BLS transaction, or all of the normal token transfers
* Tx Hash - Hash of the transaction on the Arbitrum Testnet

### Results
| Commit | Tx Type | Number Txs | L1 Calldata Units Used | L1 Transaction Units | L2 Computation Units | L2 Storage Units | L1 Calldata Cost | L2 Tx Cost | L2 Storage Cost | L2 Computation Cost | Total Cost (ETH) | Tx Hash |
| ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- |---------------------| ----------- |------------------|
| 116c920b2469d279773c2546b0f00575828c11c2 | BLS | 31 | 23388 | 1 | 312116 | 1 | 0.0015691 | 0.0001342 | 0.0000292 | 0.0001821 | 0.0019145 | 0xae4c5f62536743630eab5056671296e130bcd9d64650013a86c268fd59c6bc81 |
| 116c920b2469d279773c2546b0f00575828c11c2 | Normal | 31 | 60388 | 31 | 25730 | 0 | 0.0040514 | 0.0041596 | 0.0000000 | 0.0000150 | 0.0082260 | 0x78cfceea76233ed83a49d67919ec4e6ce30d71a15cbcb64821514a1eabed257c |
