/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import {Signer} from "ethers";
import {Provider, TransactionRequest} from "@ethersproject/providers";
import {Contract, ContractFactory, Overrides} from "@ethersproject/contracts";

import {TestTransfer} from "./TestTransfer";

export class TestTransferFactory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(overrides?: Overrides): Promise<TestTransfer> {
    return super.deploy(overrides || {}) as Promise<TestTransfer>;
  }
  getDeployTransaction(overrides?: Overrides): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): TestTransfer {
    return super.attach(address) as TestTransfer;
  }
  connect(signer: Signer): TestTransferFactory {
    return super.connect(signer) as TestTransferFactory;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): TestTransfer {
    return new Contract(address, _abi, signerOrProvider) as TestTransfer;
  }
}

const _abi = [
  {
    constant: false,
    inputs: [
      {
        internalType: "uint256[2]",
        name: "signature",
        type: "uint256[2]"
      },
      {
        components: [
          {
            components: [
              {
                internalType: "uint256",
                name: "pubkeyID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "tokenID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "balance",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256"
              }
            ],
            internalType: "struct Types.UserState[]",
            name: "states",
            type: "tuple[]"
          },
          {
            internalType: "bytes32[][]",
            name: "stateWitnesses",
            type: "bytes32[][]"
          },
          {
            internalType: "uint256[4][]",
            name: "pubkeys",
            type: "uint256[4][]"
          },
          {
            internalType: "bytes32[][]",
            name: "pubkeyWitnesses",
            type: "bytes32[][]"
          }
        ],
        internalType: "struct Types.SignatureProof",
        name: "proof",
        type: "tuple"
      },
      {
        internalType: "bytes32",
        name: "stateRoot",
        type: "bytes32"
      },
      {
        internalType: "bytes32",
        name: "accountRoot",
        type: "bytes32"
      },
      {
        internalType: "bytes32",
        name: "domain",
        type: "bytes32"
      },
      {
        internalType: "bytes",
        name: "txs",
        type: "bytes"
      }
    ],
    name: "_checkSignature",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      },
      {
        internalType: "enum Types.Result",
        name: "",
        type: "uint8"
      }
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "uint256[2]",
        name: "signature",
        type: "uint256[2]"
      },
      {
        components: [
          {
            components: [
              {
                internalType: "uint256",
                name: "pubkeyID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "tokenID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "balance",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256"
              }
            ],
            internalType: "struct Types.UserState[]",
            name: "states",
            type: "tuple[]"
          },
          {
            internalType: "bytes32[][]",
            name: "stateWitnesses",
            type: "bytes32[][]"
          },
          {
            internalType: "uint256[4][]",
            name: "pubkeys",
            type: "uint256[4][]"
          },
          {
            internalType: "bytes32[][]",
            name: "pubkeyWitnesses",
            type: "bytes32[][]"
          }
        ],
        internalType: "struct Types.SignatureProof",
        name: "proof",
        type: "tuple"
      },
      {
        internalType: "bytes32",
        name: "stateRoot",
        type: "bytes32"
      },
      {
        internalType: "bytes32",
        name: "accountRoot",
        type: "bytes32"
      },
      {
        internalType: "bytes32",
        name: "domain",
        type: "bytes32"
      },
      {
        internalType: "bytes",
        name: "txs",
        type: "bytes"
      }
    ],
    name: "checkSignature",
    outputs: [
      {
        internalType: "enum Types.Result",
        name: "",
        type: "uint8"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "bytes32",
        name: "stateRoot",
        type: "bytes32"
      },
      {
        internalType: "uint256",
        name: "maxTxSize",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "feeReceiver",
        type: "uint256"
      },
      {
        internalType: "bytes",
        name: "txs",
        type: "bytes"
      },
      {
        components: [
          {
            components: [
              {
                internalType: "uint256",
                name: "pubkeyID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "tokenID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "balance",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256"
              }
            ],
            internalType: "struct Types.UserState",
            name: "state",
            type: "tuple"
          },
          {
            internalType: "bytes32[]",
            name: "witness",
            type: "bytes32[]"
          }
        ],
        internalType: "struct Types.StateMerkleProof[]",
        name: "proofs",
        type: "tuple[]"
      }
    ],
    name: "processTransferCommit",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      },
      {
        internalType: "enum Types.Result",
        name: "result",
        type: "uint8"
      }
    ],
    payable: false,
    stateMutability: "pure",
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "bytes32",
        name: "_balanceRoot",
        type: "bytes32"
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "fromIndex",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "toIndex",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "amount",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "fee",
            type: "uint256"
          }
        ],
        internalType: "struct Tx.Transfer",
        name: "_tx",
        type: "tuple"
      },
      {
        internalType: "uint256",
        name: "tokenID",
        type: "uint256"
      },
      {
        components: [
          {
            components: [
              {
                internalType: "uint256",
                name: "pubkeyID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "tokenID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "balance",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256"
              }
            ],
            internalType: "struct Types.UserState",
            name: "state",
            type: "tuple"
          },
          {
            internalType: "bytes32[]",
            name: "witness",
            type: "bytes32[]"
          }
        ],
        internalType: "struct Types.StateMerkleProof",
        name: "from",
        type: "tuple"
      },
      {
        components: [
          {
            components: [
              {
                internalType: "uint256",
                name: "pubkeyID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "tokenID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "balance",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256"
              }
            ],
            internalType: "struct Types.UserState",
            name: "state",
            type: "tuple"
          },
          {
            internalType: "bytes32[]",
            name: "witness",
            type: "bytes32[]"
          }
        ],
        internalType: "struct Types.StateMerkleProof",
        name: "to",
        type: "tuple"
      }
    ],
    name: "testProcessTransfer",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      },
      {
        internalType: "enum Types.Result",
        name: "",
        type: "uint8"
      }
    ],
    payable: false,
    stateMutability: "pure",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        internalType: "bytes32",
        name: "stateRoot",
        type: "bytes32"
      },
      {
        internalType: "uint256",
        name: "maxTxSize",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "feeReceiver",
        type: "uint256"
      },
      {
        internalType: "bytes",
        name: "txs",
        type: "bytes"
      },
      {
        components: [
          {
            components: [
              {
                internalType: "uint256",
                name: "pubkeyID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "tokenID",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "balance",
                type: "uint256"
              },
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256"
              }
            ],
            internalType: "struct Types.UserState",
            name: "state",
            type: "tuple"
          },
          {
            internalType: "bytes32[]",
            name: "witness",
            type: "bytes32[]"
          }
        ],
        internalType: "struct Types.StateMerkleProof[]",
        name: "proofs",
        type: "tuple[]"
      }
    ],
    name: "testProcessTransferCommit",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  }
];

const _bytecode =
  "0x608060405234801561001057600080fd5b50613302806100206000396000f3fe608060405234801561001057600080fd5b50600436106100575760003560e01c8063729ba7f01461005c57806384cbb9e61461008557806392931492146100a6578063bb157c7d146100b9578063e83436d2146100cc575b600080fd5b61006f61006a3660046129b5565b6100ed565b60405161007c91906130ae565b60405180910390f35b6100986100933660046129b5565b61010a565b60405161007c929190613093565b6100986100b4366004612b34565b610138565b6100986100c7366004612a90565b61027e565b6100df6100da366004612b34565b61029c565b60405161007c929190613078565b60006100fd8787878787876102c7565b90505b9695505050505050565b60008060005a905060006101228a8a8a8a8a8a6100ed565b90505a909103925090505b965096945050505050565b60008061014484610513565b1561015457508590506008610274565b600061015f8561052b565b905086811115610176578760099250925050610274565b600080905060008560008151811061018a57fe5b6020026020010151600001516020015190506101a4612464565b60005b84811015610243576101bf898263ffffffff61053f16565b91506101fd8c83858b85600202815181106101d657fe5b60200260200101518c86600202600101815181106101f057fe5b60200260200101516105b3565b909c509550600086600a81111561021057fe5b1461022357508a95506102749350505050565b606082015161023990859063ffffffff61061016565b93506001016101a7565b506102678b8a84868b896002028151811061025a57fe5b602002602001015161063c565b909b508b96509450505050505b9550959350505050565b60008061028e87878787876105b3565b915091509550959350505050565b6000806000805a90506102b28989898989610138565b509150815a909a910398509650505050505050565b6000806102d38361052b565b905060608160405190808252806020026020018201604052801561031157816020015b6102fe61248c565b8152602001906001900390816102f65790505b50905060005b828110156104c757610327612464565b610337868363ffffffff61053f16565b90506103868961035d8c60000151858151811061035057fe5b60200260200101516106ea565b8051906020012083600001518d60200151868151811061037957fe5b6020026020010151610729565b6103ab5760405162461bcd60e51b81526004016103a2906130dd565b60405180910390fd5b610419888b6040015184815181106103bf57fe5b60200260200101516040516020016103d79190612fa5565b604051602081830303815290604052805190602001208c6000015185815181106103fd57fe5b6020026020010151600001518d60600151868151811061037957fe5b6104355760405162461bcd60e51b81526004016103a29061314d565b60008a60000151838151811061044757fe5b602002602001015160600151116104705760405162461bcd60e51b81526004016103a29061310d565b606061049a8260018d60000151868151811061048857fe5b60200260200101516060015103610741565b90506104a68882610786565b8484815181106104b257fe5b60209081029190910101525050600101610317565b506000806104da8b8b6040015185610845565b92509050816104f057600a945050505050610100565b80610502576005945050505050610100565b5060009a9950505050505050505050565b6000600c82518161052057fe5b06151590505b919050565b6000600c82518161053857fe5b0492915050565b610547612464565b506004600c8281028401918201516008830151600a80850151948401516040805160808101825263ffffffff9586168152939094166020840152600f86861c8116830a610fff97881602948401949094529384901c90921690910a919092160260608201525b92915050565b6000806105d08787600001518789604001518a6060015189610be2565b9092509050600081600a8111156105e357fe5b146105ed57610274565b6106028287602001518789604001518761063c565b909890975095505050505050565b6000828201838110156106355760405162461bcd60e51b81526004016103a2906130ed565b9392505050565b6000806106628761065085600001516106ea565b80519060200120888660200151610729565b61067e5760405162461bcd60e51b81526004016103a29061316d565b610686612464565b600061069787878760000151610c92565b9092509050600081600a8111156106aa57fe5b146106bc576000935091506102749050565b6106da6106c8836106ea565b80519060200120898760200151610d03565b9960009950975050505050505050565b606081600001518260200151836040015184606001516040516020016107139493929190612fc6565b6040516020818303038152906040529050919050565b600084610737858585610d03565b1495945050505050565b6060600183600001518460200151848660400151876060015160405160200161076f9695949392919061300e565b604051602081830303815290604052905092915050565b61078e61248c565b61079661248c565b6107a08484610dae565b90506107aa61248c565b6107bb8260005b6020020151610e83565b90506107c561248c565b6107d08360016107b1565b90506107da6124aa565b825181526020808401518282015282516040808401919091529083015160608301526000908460808460066107d05a03fa90508080156108195761081b565bfe5b50806108395760405162461bcd60e51b81526004016103a2906130cd565b50919695505050505050565b81516000908190806108695760405162461bcd60e51b81526004016103a29061312d565b835181146108895760405162461bcd60e51b81526004016103a2906130fd565b60008160010160060290506060816040519080825280602002602001820160405280156108c0578160200160208202803883390190505b5090508760006020020151816000815181106108d857fe5b60209081029190910101528760016020020151816001815181106108f857fe5b6020026020010181815250507f198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c28160028151811061093257fe5b6020026020010181815250507f1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed8160038151811061096c57fe5b6020026020010181815250507f275dc4a288d1afb3cbb1ac09187524c7db36395df7be3b99e673b13a075a65ec816004815181106109a657fe5b6020026020010181815250507f1d9befcd05a5323e6da4d435f3b617cdb3af83285c2df711ef39c01571827f9d816005815181106109e057fe5b602090810291909101015260005b83811015610b8f57868181518110610a0257fe5b6020026020010151600060028110610a1657fe5b6020020151828260060260060181518110610a2d57fe5b602002602001018181525050868181518110610a4557fe5b6020026020010151600160028110610a5957fe5b6020020151828260060260070181518110610a7057fe5b602002602001018181525050878181518110610a8857fe5b6020026020010151600160048110610a9c57fe5b6020020151828260060260080181518110610ab357fe5b602002602001018181525050878181518110610acb57fe5b6020026020010151600060048110610adf57fe5b6020020151828260060260090181518110610af657fe5b602002602001018181525050878181518110610b0e57fe5b6020026020010151600360048110610b2257fe5b60200201518282600602600a0181518110610b3957fe5b602002602001018181525050878181518110610b5157fe5b6020026020010151600260048110610b6557fe5b60200201518282600602600b0181518110610b7c57fe5b60209081029190910101526001016109ee565b50610b986124c8565b6000610ba3856111ff565b90506020826020860260208601600885fa955085610bcc57600080965096505050505050610bda565b505115159450600193505050505b935093915050565b600080610c0888610bf685600001516106ea565b80519060200120898660200151610729565b610c245760405162461bcd60e51b81526004016103a29061311d565b610c2c612464565b6000610c3e8888888860000151611210565b9092509050600081600a811115610c5157fe5b14610c635760009350915061012d9050565b610c81610c6f836106ea565b805190602001208a8760200151610d03565b9a60009a5098505050505050505050565b610c9a612464565b600084836020015114610cb257508190506004610bda565b60405180608001604052808460000151815260200184602001518152602001610ce886866040015161061090919063ffffffff16565b81526060850151602090910152915060009050935093915050565b600083815b8351811015610da557600185821c16610d5e5781848281518110610d2857fe5b6020026020010151604051602001610d41929190613078565b604051602081830303815290604052805190602001209150610d9d565b838181518110610d6a57fe5b602002602001015182604051602001610d84929190613078565b6040516020818303038152906040528051906020012091505b600101610d08565b50949350505050565b610db661248c565b6060610dc284846112de565b9050600080600080601885016001600160c01b0381511693506030860190506001600160c01b0381511694506000805160206132a0833981519152856000805160206132a0833981519152600160c01b87090892506048860190506001600160c01b0381511693506060860190506001600160c01b0381511694506000805160206132a0833981519152856000805160206132a0833981519152600160c01b8709086040805180820190915293845260208401525090979650505050505050565b610e8b61248c565b6000805160206132a08339815191528210610eb85760405162461bcd60e51b81526004016103a29061313d565b816000610ec482611546565b91505060006000805160206132a083398151915280610edf57fe5b83840990506000805160206132a083398151915260048208905060006000805160206132a083398151915277b3c4d79d41a91759a9e4c7e359b6b89eaec68e62effffffd8509905060006000805160206132a08339815191528383099050610f468161156f565b90506000805160206132a083398151915282830991506000805160206132a083398151915281830991506000805160206132a083398151915282860991506000805160206132a0833981519152826000805160206132a0833981519152037759e26bcea0d48bacd4f263f1acdb5c4f5763473177fffffe0894506000805160206132a083398151915285860991506000805160206132a083398151915285830991506000805160206132a0833981519152600383089150600061100883611546565b9093509050801561104b578461102c57826000805160206132a08339815191520392505b5050604080518082019091529384526020840152509091506105269050565b6000805160206132a0833981519152600187086000805160206132a08339815191520395506000805160206132a08339815191528061108657fe5b86870992506000805160206132a083398151915286840992506000805160206132a08339815191526003840892506110bd83611546565b909350905080156110fc578461102c575050604080518082019091529384526000805160206132a0833981519152036020840152509091506105269050565b6000805160206132a083398151915284850995506000805160206132a083398151915286870995506000805160206132a083398151915282870995506000805160206132a083398151915282870995506000805160206132a08339815191526001870895506000805160206132a083398151915286870992506000805160206132a083398151915286840992506000805160206132a08339815191526003840892506111a783611546565b9093509050806111c95760405162461bcd60e51b81526004016103a29061315d565b846111e257826000805160206132a08339815191520392505b505060408051808201909152938452602084015250909392505050565b600181016184d00261afc801919050565b611218612464565b60008461122a575081905060016112d5565b600061123c868663ffffffff61061016565b905080846040015110156112575783600292509250506112d5565b8684602001511461126f5783600392509250506112d5565b611277612464565b604051806080016040528086600001518152602001866020015181526020016112ad84886040015161157a90919063ffffffff16565b81526020016112ca6001886060015161061090919063ffffffff16565b905293506000925050505b94509492505050565b80516040805160648301808252601f1960838501168201602001909252606092918391908015611315576020820181803883390190505b506040805160608082526080820190925291925090816020820181803883390190505090506060820160005b8481101561135b5760208188018101518383015201611341565b50830160008153600101606081536001016000815360018101879052602101602081535060006002836040516113919190612fba565b602060405180830381855afa1580156113ae573d6000803e3d6000fd5b5050506040513d601f19601f820116820180604052506113d19190810190612a6a565b90506000604294508484528160208501526001604085015360418401889052602060618501536002846040516114079190612fba565b602060405180830381855afa158015611424573d6000803e3d6000fd5b5050506040513d601f19601f820116820180604052506114479190810190612a6a565b90508060208401528082188060208601526002604086015360418501899052602060618601535060028460405161147e9190612fba565b602060405180830381855afa15801561149b573d6000803e3d6000fd5b5050506040513d601f19601f820116820180604052506114be9190810190612a6a565b9050806040840152808218806020860152600360408601536041850189905260206061860153506002846040516114f59190612fba565b602060405180830381855afa158015611512573d6000803e3d6000fd5b5050506040513d601f19601f820116820180604052506115359190810190612a6a565b606084015250909695505050505050565b600080611552836115bc565b9150826000805160206132a0833981519152838409149050915091565b60006105ad82611cf1565b600061063583836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f770000815250612438565b60006000805160206132a08339815191528083840991508083830981838209828283098385830984848309858484098684850997508684840987858409945087898a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087818a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087898a09985087898a09985087818a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087898a09985087898a09985087838a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087818a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087858a09985087898a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087858a09985087898a09985087898a09985087898a09985087898a09985087838a09985087898a09985087898a09985087898a09985087898a09985087858a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087898a09985087898a09985087838a09985087898a099a9950505050505050505050565b60006000805160206132a08339815191528083840991508083830981838209828283098385830984848309858484098684850997508684840987858409945087898a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087818a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087898a09985087898a09985087818a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a09985087898a09985087898a09985087898a09985087838a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087848a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087818a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087858a09985087898a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087828a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087878a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087858a09985087898a09985087898a09985087898a09985087898a09985087838a09985087898a09985087898a09985087898a09985087898a09985087858a09985087898a09985087898a09985087898a09985087868a09985087898a09985087898a099850878a8a09985087898a09985087898a09985087898a09985087898a09985087898a09985087898a09985087868a099a9950505050505050505050565b6000818484111561245c5760405162461bcd60e51b81526004016103a291906130bc565b505050900390565b6040518060800160405280600081526020016000815260200160008152602001600081525090565b60405180604001604052806002906020820280388339509192915050565b60405180608001604052806004906020820280388339509192915050565b60405180602001604052806001906020820280388339509192915050565b600082601f8301126124f757600080fd5b813561250a612505826131a3565b61317d565b81815260209384019390925082018360005b83811015612548578135860161253288826125c4565b845250602092830192919091019060010161251c565b5050505092915050565b600082601f83011261256357600080fd5b8135612571612505826131a3565b9150818183526020840193506020810190508385608084028201111561259657600080fd5b60005b8381101561254857816125ac8882612764565b84525060209092019160809190910190600101612599565b600082601f8301126125d557600080fd5b81356125e3612505826131a3565b9150818183526020840193506020810190508385602084028201111561260857600080fd5b60005b83811015612548578161261e88826127c5565b845250602092830192919091019060010161260b565b600082601f83011261264557600080fd5b8135612653612505826131a3565b81815260209384019390925082018360005b83811015612548578135860161267b88826128f4565b8452506020928301929190910190600101612665565b600082601f8301126126a257600080fd5b81356126b0612505826131a3565b915081818352602084019350602081019050838560808402820111156126d557600080fd5b60005b8381101561254857816126eb8882612952565b845250602090920191608091909101906001016126d8565b600082601f83011261271457600080fd5b6002612722612505826131c3565b9150818385602084028201111561273857600080fd5b60005b83811015612548578161274e88826127c5565b845250602092830192919091019060010161273b565b600082601f83011261277557600080fd5b6004612783612505826131c3565b9150818385602084028201111561279957600080fd5b60005b8381101561254857816127af88826127c5565b845250602092830192919091019060010161279c565b80356105ad8161328b565b80516105ad8161328b565b600082601f8301126127ec57600080fd5b81356127fa612505826131e0565b9150808252602083016020830185838301111561281657600080fd5b612821838284613238565b50505092915050565b60006080828403121561283c57600080fd5b612846608061317d565b905081356001600160401b0381111561285e57600080fd5b61286a84828501612691565b82525060208201356001600160401b0381111561288657600080fd5b612892848285016124e6565b60208301525060408201356001600160401b038111156128b157600080fd5b6128bd84828501612552565b60408301525060608201356001600160401b038111156128dc57600080fd5b6128e8848285016124e6565b60608301525092915050565b600060a0828403121561290657600080fd5b612910604061317d565b9050600061291e8484612952565b82525060808201356001600160401b0381111561293a57600080fd5b612946848285016125c4565b60208301525092915050565b60006080828403121561296457600080fd5b61296e608061317d565b9050600061297c84846127c5565b825250602061298d848483016127c5565b60208301525060406129a1848285016127c5565b60408301525060606128e8848285016127c5565b60008060008060008060e087890312156129ce57600080fd5b60006129da8989612703565b96505060408701356001600160401b038111156129f657600080fd5b612a0289828a0161282a565b9550506060612a1389828a016127c5565b9450506080612a2489828a016127c5565b93505060a0612a3589828a016127c5565b92505060c08701356001600160401b03811115612a5157600080fd5b612a5d89828a016127db565b9150509295509295509295565b600060208284031215612a7c57600080fd5b6000612a8884846127d0565b949350505050565b60008060008060006101008688031215612aa957600080fd5b6000612ab588886127c5565b9550506020612ac688828901612952565b94505060a0612ad7888289016127c5565b93505060c08601356001600160401b03811115612af357600080fd5b612aff888289016128f4565b92505060e08601356001600160401b03811115612b1b57600080fd5b612b27888289016128f4565b9150509295509295909350565b600080600080600060a08688031215612b4c57600080fd5b6000612b5888886127c5565b9550506020612b69888289016127c5565b9450506040612b7a888289016127c5565b93505060608601356001600160401b03811115612b9657600080fd5b612ba2888289016127db565b92505060808601356001600160401b03811115612bbe57600080fd5b612b2788828901612634565b6000612bd68383612c32565b505060200190565b612be78161320a565b612bf18184610526565b9250612bfc82613207565b8060005b83811015612c2a578151612c148782612bca565b9650612c1f83613214565b925050600101612c00565b505050505050565b612c3b81613207565b82525050565b6000612c4c82613210565b612c568185610526565b9350612c66818560208601613244565b9290920192915050565b612c3b8161322d565b6000612c8482613210565b612c8e818561321a565b9350612c9e818560208601613244565b612ca781613274565b9093019392505050565b6000612cbe60178361321a565b7f424c533a20626e206164642063616c6c206661696c6564000000000000000000815260200192915050565b6000612cf760248361321a565b7f41757468656e7469636974793a20737461746520696e636c7573696f6e20736981526333b732b960e11b602082015260400192915050565b6000612d3d601b8361321a565b7f536166654d6174683a206164646974696f6e206f766572666c6f770000000000815260200192915050565b6000612d7660358361321a565b7f424c533a206e756d626572206f66207075626c6963206b65797320616e64206d815274195cdcd859d95cc81b5d5cdd08189948195c5d585b605a1b602082015260400192915050565b6000612dcd60188361321a565b7f41757468656e7469636974793a207a65726f206e6f6e63650000000000000000815260200192915050565b6000612e0660218361321a565b7f5472616e736974696f6e3a2053656e64657220646f6573206e6f7420657869738152601d60fa1b602082015260400192915050565b6000612e4960218361321a565b7f424c533a206e756d626572206f66207075626c6963206b6579206973207a65728152606f60f81b602082015260400192915050565b6000612e8c60238361321a565b7f6d6170546f506f696e7446543a20696e76616c6964206669656c6420656c656d815262195b9d60ea1b602082015260400192915050565b6000612ed160258361321a565b7f41757468656e7469636974793a206163636f756e7420646f6573206e6f742065815264786973747360d81b602082015260400192915050565b6000612f1860228361321a565b7f424c533a20626164206674206d617070696e6720696d706c656d656e7461746981526137b760f11b602082015260400192915050565b6000612f5c60238361321a565b7f5472616e736974696f6e3a20726563656976657220646f6573206e6f742065788152621a5cdd60ea1b602082015260400192915050565b612c3b612fa082613207565b613207565b6000612fb18284612bde565b50608001919050565b60006106358284612c41565b6000612fd28287612f94565b602082019150612fe28286612f94565b602082019150612ff28285612f94565b6020820191506130028284612f94565b50602001949350505050565b600061301a8289612f94565b60208201915061302a8288612f94565b60208201915061303a8287612f94565b60208201915061304a8286612f94565b60208201915061305a8285612f94565b60208201915061306a8284612f94565b506020019695505050505050565b604081016130868285612c32565b6106356020830184612c32565b604081016130a18285612c32565b6106356020830184612c70565b602081016105ad8284612c70565b602080825281016106358184612c79565b602080825281016105ad81612cb1565b602080825281016105ad81612cea565b602080825281016105ad81612d30565b602080825281016105ad81612d69565b602080825281016105ad81612dc0565b602080825281016105ad81612df9565b602080825281016105ad81612e3c565b602080825281016105ad81612e7f565b602080825281016105ad81612ec4565b602080825281016105ad81612f0b565b602080825281016105ad81612f4f565b6040518181016001600160401b038111828210171561319b57600080fd5b604052919050565b60006001600160401b038211156131b957600080fd5b5060209081020190565b60006001600160401b038211156131d957600080fd5b5060200290565b60006001600160401b038211156131f657600080fd5b506020601f91909101601f19160190565b90565b50600490565b5190565b60200190565b90815260200190565b806105268161327e565b60006105ad82613223565b82818337506000910152565b60005b8381101561325f578181015183820152602001613247565b8381111561326e576000848401525b50505050565b601f01601f191690565b600b811061328857fe5b50565b61329481613207565b811461328857600080fdfe30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47a365627a7a723158209be40e1b2acd1f2c6bdba307476971bfe2f53a2a02e81b1616dc4b2cb66f2e5b6c6578706572696d656e74616cf564736f6c634300050f0040";
