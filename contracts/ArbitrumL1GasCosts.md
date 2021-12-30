# L1 Gas Costs for Arbitrum Transactions

## Background

### Arbitrum Sequencer
In order to understand how much gas is saved by using BLS signatures on the Arbitrum network, 
a custom sequencer had to be created. 

The Arbitrum sequencer batches incoming L2 transactions and submits their call data to the SequencerInbox 
L1 smart contract via addSequencerL2BatchFromOrigin. The cost of this transaction represents the total cost 
of posting that call data onto L1. Therefore, in order to get the total cost of storing L2 transactions 
calldata on L1, one must look at the gas cost of the sequencer's addSequencerL2BatchFromOrigin call.

In order to understand the cost of BLS signature transactions, it was necessary to find a way to fill the
entire batch of transactions that the sequencer sent via addSequencerL2BatchFromOrigin with BLS signature
transactions. Therefore, a custom SequencerInbox contract was deployed to Rinkeby, and a custom sequencer
script was created. The custom sequencer script takes in any custom transactions (in our case, BLS signature
transactions) and batches them in the same way as the Arbitrum sequencer. Then the script sends them to the
custom SequencerInbox contract via addSequencerL2BatchFromOrigin, just as the Arbitrum sequencer would. The
resultant gas cost of this transaction is then divided by the number of transactions that were fit into that batch.
This gives us the gas cost of storing the calldata on L1 for each transaction.

### BLS Signature Transactions
Each L2 transaction sent to the sequencer is a BLS signed transaction that contains multiple L2 transactions 
batched together (these are token transfer transactions in our case, for testing purposes). When testing on the Arbitrum Testnet (RinkArby), it was found that the max number of L2 token transfers that would fit into one BLS signed transaction
accepted by the Arbitrum network was 29. So, each BLS signed transaction sent to the sequencer contains 29 
L2 token transfers. The sequencer script will then batch multiple of these BLS signed transactions into a single
batch and send it to our custom SequencerInbox contract.

## Results

| Commit | Number of BLS Transactions | Number of token transfers (per BLS tx) | Gas Cost (Low) | Gas Cost (High) | Gas per Token Transfer (High)|
| ----------- | ----------- | ----------- | ----------- | ----------- |  ----------- |
| 19f13a2dac16646e6f6b735516efca65e5120b61 | 25 | 29 | 764738 | 832374 | 1148 |
| 6add17241833c7a457880ef150ba1566bc75889c | 25 | 29 | 772816 | ~840000 | 1158 |

The custom sequencer script can be found here: https://github.com/kcharbo3/arbitrum-custom-sequencer