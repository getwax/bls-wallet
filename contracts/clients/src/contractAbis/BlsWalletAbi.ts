export default [
  {
    "stateMutability": "payable",
    "type": "fallback"
  },
  {
    "inputs": [],
    "name": "gateway",
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
    "inputs": [],
    "name": "getPublicKey",
    "outputs": [
      {
        "internalType": "uint256[4]",
        "name": "",
        "type": "uint256[4]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "walletGateway",
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
        "internalType": "uint256[4]",
        "name": "blsKey",
        "type": "uint256[4]"
      }
    ],
    "name": "latchPublicKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nonce",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
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
        "internalType": "struct IWallet.Operation",
        "name": "op",
        "type": "tuple"
      }
    ],
    "name": "performOperation",
    "outputs": [
      {
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      },
      {
        "internalType": "bytes[]",
        "name": "results",
        "type": "bytes[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "publicKey",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "walletGateway",
        "type": "address"
      }
    ],
    "name": "setGateway",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
];
