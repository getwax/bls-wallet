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
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256[2]",
            "name": "signature",
            "type": "uint256[2]"
          },
          {
            "internalType": "uint256[4][]",
            "name": "senderPublicKeys",
            "type": "uint256[4][]"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "nonce",
                "type": "uint256"
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
            "internalType": "struct IWallet.Operation[]",
            "name": "operations",
            "type": "tuple[]"
          }
        ],
        "internalType": "struct VerificationGateway.Bundle",
        "name": "bundle",
        "type": "tuple"
      }
    ],
    "name": "processBundle",
    "outputs": [
      {
        "internalType": "bool[]",
        "name": "successes",
        "type": "bool[]"
      },
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
        "components": [
          {
            "internalType": "uint256[2]",
            "name": "signature",
            "type": "uint256[2]"
          },
          {
            "internalType": "uint256[4][]",
            "name": "senderPublicKeys",
            "type": "uint256[4][]"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "nonce",
                "type": "uint256"
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
            "internalType": "struct IWallet.Operation[]",
            "name": "operations",
            "type": "tuple[]"
          }
        ],
        "internalType": "struct VerificationGateway.Bundle",
        "name": "bundle",
        "type": "tuple"
      }
    ],
    "name": "verify",
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
