export default [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "wallet",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "result",
        "type": "bool"
      }
    ],
    "name": "WalletActioned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "wallet",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256[4]",
        "name": "publicKey",
        "type": "uint256[4]"
      }
    ],
    "name": "WalletCreated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256[4][]",
        "name": "publicKeys",
        "type": "uint256[4][]"
      },
      {
        "internalType": "uint256[2]",
        "name": "signature",
        "type": "uint256[2]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "nonce",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ethValue",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "contractAddress",
            "type": "address"
          },
          {
            "internalType": "bytes",
            "name": "encodedFunction",
            "type": "bytes"
          }
        ],
        "internalType": "struct VerificationGateway.TxData[]",
        "name": "txs",
        "type": "tuple[]"
      }
    ],
    "name": "actionCalls",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "blsLib",
    "outputs": [
      {
        "internalType": "contract IBLS",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract IBLS",
        "name": "bls",
        "type": "address"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256[4][]",
        "name": "publicKeys",
        "type": "uint256[4][]"
      },
      {
        "internalType": "uint256[2]",
        "name": "signature",
        "type": "uint256[2]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "nonce",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ethValue",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "contractAddress",
            "type": "address"
          },
          {
            "internalType": "bytes",
            "name": "encodedFunction",
            "type": "bytes"
          }
        ],
        "internalType": "struct VerificationGateway.TxData[]",
        "name": "txs",
        "type": "tuple[]"
      }
    ],
    "name": "verifySignatures",
    "outputs": [],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "hash",
        "type": "bytes32"
      }
    ],
    "name": "walletCrossCheck",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "walletFromHash",
    "outputs": [
      {
        "internalType": "contract BLSWallet",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
