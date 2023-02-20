import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";

import { Experimental, BlsWalletWrapper } from "../clients/src";
import getNetworkConfig from "../shared/helpers/getNetworkConfig";

async function getRandomSigners(
  numSigners: number,
): Promise<typeof Experimental.BlsSigner[]> {
  const networkConfig = await getNetworkConfig("local");

  const aggregatorUrl = "http://localhost:3000";
  const verificationGateway = networkConfig.addresses.verificationGateway;
  const aggregatorUtilities = networkConfig.addresses.utilities;
  const rpcUrl = "http://localhost:8545";
  const network = {
    name: "localhost",
    chainId: 0x539, // 1337
  };

  const signers = [];
  for (let i = 0; i < numSigners; i++) {
    const privateKey = await BlsWalletWrapper.getRandomBlsPrivateKey();
    const blsProvider = new Experimental.BlsProvider(
      aggregatorUrl,
      verificationGateway,
      aggregatorUtilities,
      rpcUrl,
      network,
    );
    const blsSigner = blsProvider.getSigner(privateKey);
    signers.push(blsSigner);
  }
  return signers;
}

describe("Signer contract interaction tests", function () {
  let blsSigners;
  let fundedWallet: Wallet;

  this.beforeAll(async () => {
    fundedWallet = new ethers.Wallet(
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Hardhat Account #2 private key
      new ethers.providers.JsonRpcProvider("http://localhost:8545"),
    );
    blsSigners = await getRandomSigners(5);

    const fundSigner = async (signer) => {
      const tx = await fundedWallet.sendTransaction({
        to: await signer.getAddress(),
        value: utils.parseEther("100"),
      });
      await tx.wait();
    };

    // Give all signers some Ether
    for (let i = 0; i < blsSigners.length; i++) {
      await fundSigner(blsSigners[i]);
    }
  });

  describe("ERC20", async () => {
    let mockERC20;
    let tokenSupply: BigNumber;

    this.beforeAll(async () => {
      tokenSupply = utils.parseUnits("1000000");
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockERC20 = await MockERC20.connect(fundedWallet).deploy(
        "AnyToken",
        "TOK",
        tokenSupply,
      );
      await mockERC20.deployed();

      await mockERC20.transfer(await blsSigners[0].getAddress(), tokenSupply);
    });

    it("balanceOf() call", async () => {
      const initialBalance = await mockERC20.balanceOf(
        await blsSigners[0].getAddress(),
      );
      expect(initialBalance).to.equal(tokenSupply);
    });

    // TODO: Add Contract deployment support #182
    it("deploying contract using BlsSigner fails", async () => {
      const NewMockERC20 = await ethers.getContractFactory("MockERC20");
      const deployNewMockERC20 = async () =>
        await NewMockERC20.connect(blsSigners[0]).deploy(
          "AnyToken",
          "TOK",
          tokenSupply,
        );

      await expect(deployNewMockERC20()).to.be.rejectedWith(
        TypeError,
        "Transaction.to should be defined",
      );
    });

    it("calls balanceOf successfully after instantiating Contract class with BlsSigner", async () => {
      const blsSignerAddress = await blsSigners[0].getAddress();
      const ERC20 = new ethers.Contract(
        mockERC20.address,
        mockERC20.interface,
        blsSigners[0],
      );
      expect(ERC20.signer).to.equal(blsSigners[0]);

      const initialBalance = await ERC20.balanceOf(blsSignerAddress);
      expect(initialBalance).to.equal(tokenSupply);
    });

    it("transfer() call", async () => {
      const recipient = await blsSigners[1].getAddress();

      const fee = mockERC20
        .connect(blsSigners[0])
        .estimateGas.transfer(recipient, tokenSupply.div(2));

      await expect(fee).to.not.be.rejected;

      const tx = await mockERC20
        .connect(blsSigners[0])
        .transfer(recipient, tokenSupply.div(2));
      await tx.wait();

      const newReceipientBalance = await mockERC20.balanceOf(recipient);
      expect(newReceipientBalance).to.equal(tokenSupply.div(2));
    });

    it("calls transfer() successfully after instantiating Contract class with BlsSigner", async () => {
      const ERC20 = new ethers.Contract(
        mockERC20.address,
        mockERC20.interface,
        blsSigners[0],
      );
      const recipient = await blsSigners[1].getAddress();
      const initialBalance = await mockERC20.balanceOf(recipient);
      const erc20ToTransfer = utils.parseEther("53.2134222");

      const fee = ERC20.estimateGas.transfer(recipient, erc20ToTransfer);
      await expect(fee).to.not.be.rejected;

      const tx = await ERC20.transfer(recipient, erc20ToTransfer);
      await tx.wait();

      const newReceipientBalance = await mockERC20.balanceOf(recipient);
      expect(newReceipientBalance.sub(initialBalance)).to.equal(
        erc20ToTransfer,
      );
    });

    it("approve() and transferFrom() calls", async () => {
      const owner = await blsSigners[0].getAddress();
      const spender = await blsSigners[1].getAddress();

      const initialBalance = await mockERC20.balanceOf(spender);
      const erc20ToTransfer = utils.parseEther("11.0");

      const approveFee = mockERC20
        .connect(blsSigners[0])
        .estimateGas.approve(spender, erc20ToTransfer);
      await expect(approveFee).to.not.be.rejected;

      const txApprove = await mockERC20
        .connect(blsSigners[0])
        .approve(spender, erc20ToTransfer);
      await txApprove.wait();

      const transferFee = mockERC20
        .connect(blsSigners[1])
        .estimateGas.transferFrom(owner, spender, erc20ToTransfer);
      await expect(transferFee).to.not.be.rejected;

      const txTransferFrom = await mockERC20
        .connect(blsSigners[1])
        .transferFrom(owner, spender, erc20ToTransfer);
      await txTransferFrom.wait();

      const newBalance = await mockERC20.balanceOf(spender);
      expect(newBalance.sub(initialBalance)).to.equal(erc20ToTransfer);
    });

    it("contract factory connects and reconnects to new signer", async () => {
      // Truncated as not required for test
      const mockERC20Bytecode = "0x60806040523480";

      const contractFactory = new ethers.ContractFactory(
        mockERC20.interface,
        mockERC20Bytecode,
        blsSigners[0],
      );

      expect(contractFactory.signer).to.equal(blsSigners[0]);

      const newContractFactory = contractFactory.connect(blsSigners[1]);
      expect(newContractFactory.signer).to.equal(blsSigners[1]);
    });

    // TODO: Add Contract deployment support #182
    it("deploying via new contract factory fails", async () => {
      // Taken from artifacts directory
      const mockERC20Bytecode =
        "0x60806040523480156200001157600080fd5b5060405162000dae38038062000dae83398101604081905262000034916200022b565b828260036200004483826200032c565b5060046200005382826200032c565b5050506200006833826200007160201b60201c565b5050506200041f565b6001600160a01b038216620000cc5760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015260640160405180910390fd5b8060026000828254620000e09190620003f8565b90915550506001600160a01b038216600090815260208190526040812080548392906200010f908490620003f8565b90915550506040518181526001600160a01b038316906000907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a35050565b505050565b634e487b7160e01b600052604160045260246000fd5b600082601f8301126200018657600080fd5b81516001600160401b0380821115620001a357620001a36200015e565b604051601f8301601f19908116603f01168101908282118183101715620001ce57620001ce6200015e565b81604052838152602092508683858801011115620001eb57600080fd5b600091505b838210156200020f5785820183015181830184015290820190620001f0565b83821115620002215760008385830101525b9695505050505050565b6000806000606084860312156200024157600080fd5b83516001600160401b03808211156200025957600080fd5b620002678783880162000174565b945060208601519150808211156200027e57600080fd5b506200028d8682870162000174565b925050604084015190509250925092565b600181811c90821680620002b357607f821691505b602082108103620002d457634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156200015957600081815260208120601f850160051c81016020861015620003035750805b601f850160051c820191505b8181101562000324578281556001016200030f565b505050505050565b81516001600160401b038111156200034857620003486200015e565b62000360816200035984546200029e565b84620002da565b602080601f8311600181146200039857600084156200037f5750858301515b600019600386901b1c1916600185901b17855562000324565b600085815260208120601f198616915b82811015620003c957888601518255948401946001909101908401620003a8565b5085821015620003e85787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b600082198211156200041a57634e487b7160e01b600052601160045260246000fd5b500190565b61097f806200042f6000396000f3fe608060405234801561001057600080fd5b50600436106100a45760003560e01c806306fdde03146100a9578063095ea7b3146100c757806318160ddd146100ea57806323b872dd146100fc578063313ce5671461010f578063395093511461011e57806340c10f191461013157806370a082311461014657806395d89b411461016f578063a457c2d714610177578063a9059cbb1461018a578063dd62ed3e1461019d575b600080fd5b6100b16101b0565b6040516100be919061079d565b60405180910390f35b6100da6100d536600461080e565b610242565b60405190151581526020016100be565b6002545b6040519081526020016100be565b6100da61010a366004610838565b61025a565b604051601281526020016100be565b6100da61012c36600461080e565b61027e565b61014461013f36600461080e565b6102a0565b005b6100ee610154366004610874565b6001600160a01b031660009081526020819052604090205490565b6100b16102ae565b6100da61018536600461080e565b6102bd565b6100da61019836600461080e565b61033d565b6100ee6101ab366004610896565b61034b565b6060600380546101bf906108c9565b80601f01602080910402602001604051908101604052809291908181526020018280546101eb906108c9565b80156102385780601f1061020d57610100808354040283529160200191610238565b820191906000526020600020905b81548152906001019060200180831161021b57829003601f168201915b5050505050905090565b600033610250818585610376565b5060019392505050565b60003361026885828561049a565b610273858585610514565b506001949350505050565b600033610250818585610291838361034b565b61029b9190610903565b610376565b6102aa82826106d0565b5050565b6060600480546101bf906108c9565b600033816102cb828661034b565b9050838110156103305760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b60648201526084015b60405180910390fd5b6102738286868403610376565b600033610250818585610514565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b6001600160a01b0383166103d85760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b6064820152608401610327565b6001600160a01b0382166104395760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b6064820152608401610327565b6001600160a01b0383811660008181526001602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b60006104a6848461034b565b9050600019811461050e57818110156105015760405162461bcd60e51b815260206004820152601d60248201527f45524332303a20696e73756666696369656e7420616c6c6f77616e63650000006044820152606401610327565b61050e8484848403610376565b50505050565b6001600160a01b0383166105785760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b6064820152608401610327565b6001600160a01b0382166105da5760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b6064820152608401610327565b6001600160a01b038316600090815260208190526040902054818110156106525760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b6064820152608401610327565b6001600160a01b03808516600090815260208190526040808220858503905591851681529081208054849290610689908490610903565b92505081905550826001600160a01b0316846001600160a01b031660008051602061092a833981519152846040516106c391815260200190565b60405180910390a361050e565b6001600160a01b0382166107265760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f2061646472657373006044820152606401610327565b80600260008282546107389190610903565b90915550506001600160a01b03821660009081526020819052604081208054839290610765908490610903565b90915550506040518181526001600160a01b0383169060009060008051602061092a8339815191529060200160405180910390a35050565b600060208083528351808285015260005b818110156107ca578581018301518582016040015282016107ae565b818111156107dc576000604083870101525b50601f01601f1916929092016040019392505050565b80356001600160a01b038116811461080957600080fd5b919050565b6000806040838503121561082157600080fd5b61082a836107f2565b946020939093013593505050565b60008060006060848603121561084d57600080fd5b610856846107f2565b9250610864602085016107f2565b9150604084013590509250925092565b60006020828403121561088657600080fd5b61088f826107f2565b9392505050565b600080604083850312156108a957600080fd5b6108b2836107f2565b91506108c0602084016107f2565b90509250929050565b600181811c908216806108dd57607f821691505b6020821081036108fd57634e487b7160e01b600052602260045260246000fd5b50919050565b6000821982111561092457634e487b7160e01b600052601160045260246000fd5b50019056feddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3efa2646970667358221220ab6a94396731948535204a8026eaf25f6b11f6c7e951d939bf58529e4046659f64736f6c634300080f0033";

      const contractFactory = new ethers.ContractFactory(
        mockERC20.interface,
        mockERC20Bytecode,
        blsSigners[0],
      );

      expect(contractFactory.signer).to.equal(blsSigners[0]);

      const deploy = async () =>
        await contractFactory.deploy("AnyToken", "TOK", tokenSupply);

      await expect(deploy()).to.be.rejectedWith(
        TypeError,
        "Transaction.to should be defined",
      );
    });
  });

  describe("ERC721", function () {
    let mockERC721;

    this.beforeAll(async () => {
      const MockERC721 = await ethers.getContractFactory("MockERC721");
      mockERC721 = await MockERC721.connect(fundedWallet).deploy(
        "AnyNFT",
        "NFT",
      );
      await mockERC721.deployed();
    });

    // TODO: Investigate why safeMint() fails with a BLS wallet address. Note - it passes in isolation
    it.skip("safeMint() call fails with BLS wallet address", async () => {
      const recipient = await blsSigners[1].getAddress();
      const tokenId = 1;

      const mint = await mockERC721
        .connect(blsSigners[0])
        .safeMint(recipient, tokenId);
      await mint.wait();

      const ownerOf = async () =>
        await mockERC721.connect(blsSigners[0]).ownerOf(tokenId);

      await expect(ownerOf()).to.be.rejectedWith(
        Error,
        "ERC721: invalid token ID",
      );
    });

    it("safeMint() call passes with EOA address", async () => {
      const recipient = ethers.Wallet.createRandom().address;
      const tokenId = 2;

      const fee = mockERC721
        .connect(blsSigners[0])
        .estimateGas.safeMint(recipient, tokenId);
      await expect(fee).to.not.be.rejected;

      const mint = await mockERC721
        .connect(blsSigners[0])
        .safeMint(recipient, tokenId);
      await mint.wait();

      expect(await mockERC721.connect(blsSigners[1]).ownerOf(tokenId)).to.equal(
        recipient,
      );
    });

    it("mint() call", async () => {
      const recipient = await blsSigners[1].getAddress();
      const tokenId = 3;

      const fee = mockERC721
        .connect(blsSigners[0])
        .estimateGas.mint(recipient, tokenId);
      await expect(fee).to.not.be.rejected;

      const mint = await mockERC721
        .connect(blsSigners[0])
        .mint(recipient, tokenId);
      await mint.wait();

      expect(await mockERC721.connect(blsSigners[1]).ownerOf(tokenId)).to.equal(
        recipient,
      );
    });

    it("balanceOf() call", async () => {
      const recipient = await blsSigners[1].getAddress();
      const initialBalance = await mockERC721.balanceOf(recipient);
      const tokenId = 4;

      const mint = await mockERC721
        .connect(blsSigners[0])
        .mint(recipient, tokenId);
      await mint.wait();

      expect(
        (await mockERC721.balanceOf(recipient)).sub(initialBalance),
      ).to.equal(1);
    });

    it("transfer() call", async () => {
      const tokenId = 5;
      const owner = await blsSigners[3].getAddress();
      const recipient = await blsSigners[2].getAddress();

      // Mint a token to signer[3]
      const mint = await mockERC721.connect(blsSigners[0]).mint(owner, tokenId);
      await mint.wait();

      // Check signer[3] owns the token
      expect(await mockERC721.ownerOf(tokenId)).to.equal(owner);

      const fee = mockERC721
        .connect(blsSigners[3])
        .estimateGas.transferFrom(owner, recipient, tokenId);
      await expect(fee).to.not.be.rejected;

      // Transfer the token from signer 3 to signer 2
      const transfer = await mockERC721
        .connect(blsSigners[3])
        .transferFrom(owner, recipient, tokenId);
      await transfer.wait();

      // Check signer[2] now owns the token
      expect(await mockERC721.ownerOf(tokenId)).to.equal(recipient);
    });

    it("approve() call", async () => {
      const owner = await blsSigners[4].getAddress();
      const spender = await blsSigners[1].getAddress();

      // Mint a token to signer[4]
      const tokenId = 6;
      const mint = await mockERC721
        .connect(blsSigners[0])
        .safeMint(owner, tokenId);
      await mint.wait();

      const fee = mockERC721
        .connect(blsSigners[4])
        .estimateGas.approve(spender, tokenId);
      await expect(fee).to.not.be.rejected;

      // Approve the token for signer[1] address
      const approve = await mockERC721
        .connect(blsSigners[4])
        .approve(spender, tokenId);
      await approve.wait();

      // Check signer[1]'s address is now an approved address for the token
      expect(await mockERC721.getApproved(tokenId)).to.equal(spender);
    });
  });
});
