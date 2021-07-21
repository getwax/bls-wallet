import {
  BigNumber,
  Contract,
  ethers,
  hubbleBls,
  Wallet,
} from "../../deps/index.ts";

import * as env from "./env.ts";
import ovmContractABIs from "../../ovmContractABIs/index.ts";
import type { TransactionData } from "./TxTable.ts";
import AddTransactionFailure from "./AddTransactionFailure.ts";

function getKeyHash(pubkey: string) {
  return ethers.utils.keccak256(ethers.utils.solidityPack(
    ["uint256[4]"],
    [hubbleBls.mcl.loadG2(pubkey)],
  ));
}

export type TxCheckResult = {
  failures: AddTransactionFailure[];
  nextNonce: ethers.BigNumber;
};

export default class WalletService {
  aggregatorSigner: Wallet;
  erc20: Contract;
  rewardErc20: Contract;
  verificationGateway: Contract;

  constructor(public aggPrivateKey: string) {
    this.aggregatorSigner = WalletService.getAggregatorSigner(
      this.aggPrivateKey,
    );

    this.erc20 = new Contract(
      env.TOKEN_ADDRESS,
      ovmContractABIs["MockERC20.json"].abi,
      this.aggregatorSigner,
    );

    this.rewardErc20 = new Contract(
      env.REWARD_TOKEN_ADDRESS,
      ovmContractABIs["MockERC20.json"].abi,
      this.aggregatorSigner,
    );

    this.verificationGateway = new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs["VerificationGateway.json"].abi,
      this.aggregatorSigner,
    );
  }

  async checkTx(tx: TransactionData): Promise<TxCheckResult> {
    const [signedCorrectly, nextNonce]: [boolean, ethers.BigNumber] = await this
      .verificationGateway
      .checkSig(
        tx.nonce,
        ethers.BigNumber.from(tx.tokenRewardAmount),
        getKeyHash(tx.pubKey),
        hubbleBls.mcl.loadG1(tx.signature),
        tx.contractAddress,
        tx.methodId,
        tx.encodedParams,
      );

    const failures: AddTransactionFailure[] = [];

    if (signedCorrectly === false) {
      failures.push({
        type: "invalid-signature",
        description: "invalid signature",
      });
    }

    if (ethers.BigNumber.from(tx.nonce).lt(nextNonce)) {
      failures.push({
        type: "duplicate-nonce",
        description: [
          `nonce ${tx.nonce} has already been processed (the next nonce for`,
          `this wallet will be ${nextNonce.toString()})`,
        ].join(" "),
      });
    }

    return { failures, nextNonce };
  }

  async sendTxs(txs: TransactionData[]) {
    if (txs.length === 0) {
      throw new Error("Cannot process empty batch");
    }

    const txSignatures = txs.map((tx) => hubbleBls.mcl.loadG1(tx.signature));
    const aggSignature = hubbleBls.signer.aggregate(txSignatures);

    const txResponse: ethers.providers.TransactionResponse = await this
      .verificationGateway.blsCallMany(
        this.aggregatorSigner.address,
        aggSignature,
        txs.map((tx) => ({
          publicKeyHash: getKeyHash(tx.pubKey),
          tokenRewardAmount: tx.tokenRewardAmount,
          contractAddress: tx.contractAddress,
          methodID: tx.methodId,
          encodedParams: tx.encodedParams,
        })),
      );

    return await txResponse.wait();
  }

  async sendTx(tx: TransactionData) {
    const txSignature = hubbleBls.mcl.loadG1(tx.signature);

    const txResponse: ethers.providers.TransactionResponse = await this
      .verificationGateway.blsCall(
        getKeyHash(tx.pubKey),
        txSignature,
        ethers.BigNumber.from(tx.tokenRewardAmount),
        tx.contractAddress,
        tx.methodId,
        tx.encodedParams,
      );

    return await txResponse.wait();
  }

  async getBalanceOf(address: string): Promise<BigNumber> {
    return await this.erc20.balanceOf(address);
  }

  async getRewardBalanceOf(address: string): Promise<BigNumber> {
    return await this.rewardErc20.balanceOf(address);
  }

  async getAggregatorBalance(): Promise<BigNumber> {
    return await this.erc20.balanceOf(
      env.DEPLOYER_ADDRESS,
    );
  }

  async WalletAddress(pubKey: string): Promise<string | null> {
    const address: string = await this.verificationGateway.walletFromHash(
      ethers.utils.keccak256(pubKey),
    );

    if (address === ethers.constants.AddressZero) {
      return null;
    }

    return address;
  }

  private static getAggregatorSigner(privateKey: string) {
    const provider = new ethers.providers.JsonRpcProvider();
    const aggregatorSigner = new Wallet(privateKey, provider);

    if (env.USE_TEST_NET) {
      const originalPopulateTransaction = aggregatorSigner.populateTransaction
        .bind(
          aggregatorSigner,
        );

      aggregatorSigner.populateTransaction = (transaction) => {
        transaction.gasPrice = 0;
        return originalPopulateTransaction(transaction);
      };
    }

    return aggregatorSigner;
  }
}
