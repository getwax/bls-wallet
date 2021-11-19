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
            "internalType": "bool",
            "name": "atomic",
            "type": "bool"
          },
          {
            "components": [
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
            "internalType": "struct IWallet.ActionData[]",
            "name": "actions",
            "type": "tuple[]"
          }
        ],
        "internalType": "struct VerificationGateway.TxSet[]",
        "name": "txs",
        "type": "tuple[]"
      }
    ],
    "name": "actionCalls",
    "outputs": [
      {
        "internalType": "bytes[][]",
        "name": "results",
        "type": "bytes[][]"
      }
    ],
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
    "inputs": [],
    "name": "blsWalletLogic",
    "outputs": [
      {
        "internalType": "address",
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
      },
      {
        "internalType": "address",
        "name": "blsWalletImpl",
        "type": "address"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proxyAdmin",
    "outputs": [
      {
        "internalType": "contract ProxyAdmin",
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
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "transferToOrigin",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
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
            "internalType": "bool",
            "name": "atomic",
            "type": "bool"
          },
          {
            "components": [
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
            "internalType": "struct IWallet.ActionData[]",
            "name": "actions",
            "type": "tuple[]"
          }
        ],
        "internalType": "struct VerificationGateway.TxSet[]",
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
      },
      {
        "internalType": "bytes",
        "name": "encodedFunction",
        "type": "bytes"
      }
    ],
    "name": "walletAdminCall",
    "outputs": [],
    "stateMutability": "nonpayable",
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
        "name": "hash",
        "type": "bytes32"
      }
    ],
    "name": "walletFromHash",
    "outputs": [
      {
        "internalType": "contract IWallet",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
