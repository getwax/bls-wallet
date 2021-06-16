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

function getKeyHash(pubkey: string) {
  return ethers.utils.keccak256(ethers.utils.solidityPack(
    ["uint256[4]"],
    [hubbleBls.mcl.loadG2(pubkey)],
  ));
}

export default class WalletService {
  aggregatorSigner: Wallet;
  erc20: Contract;
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

    this.verificationGateway = new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      ovmContractABIs["VerificationGateway.json"].abi,
      this.aggregatorSigner,
    );
  }

  async sendTxs(txs: TransactionData[]) {
    const txSignatures = txs.map((tx) => hubbleBls.mcl.loadG1(tx.signature));
    const aggSignature = hubbleBls.signer.aggregate(txSignatures);

    const txResponse: ethers.providers.TransactionResponse = await this
      .verificationGateway.blsCallMany(
        this.aggregatorSigner.address,
        aggSignature,
        txs.map((tx) => ({
          publicKeyHash: getKeyHash(tx.pubKey),
          tokenRewardAmount: ethers.BigNumber.from(0),
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
        ethers.BigNumber.from(0),
        tx.contractAddress,
        tx.methodId,
        tx.encodedParams,
      );

    return await txResponse.wait();
  }

  async getAggregatorBalance(): Promise<BigNumber> {
    return await this.erc20.balanceOf(
      env.DEPLOYER_ADDRESS,
    );
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
