import {
  BigNumber,
  Contract,
  ethers,
  hubbleBls,
  Wallet,
} from "../../deps/index.ts";

import * as env from "./env.ts";
import contractABIs from "../../contractABIs/index.ts";
import type { TransactionData } from "./TxService.ts";

function getKeyHash(pubkey: string[]) {
  return ethers.utils.keccak256(ethers.utils.solidityPack(
    ["uint256[4]"],
    pubkey,
  ));
}

export default class WalletService {
  aggregatorSigner: Wallet;
  erc20: Contract;
  verificationGateway: Contract;

  constructor() {
    this.aggregatorSigner = WalletService.getAggregatorSigner();

    this.erc20 = new Contract(
      env.TOKEN_ADDRESS,
      contractABIs["MockERC20.ovm.json"].abi,
      this.aggregatorSigner,
    );

    this.verificationGateway = new Contract(
      env.VERIFICATION_GATEWAY_ADDRESS,
      contractABIs["VerificationGateway.ovm.json"].abi,
      this.aggregatorSigner,
    );
  }

  async sendTxs(txs: TransactionData[]) {
    const txSignatures = txs.map((tx) => hubbleBls.mcl.loadG1(tx.signature));
    const aggSignature = hubbleBls.signer.aggregate(txSignatures);

    const txResponse: ethers.providers.TransactionResponse = await this
      .verificationGateway.blsCallMany(
        txs.map((tx) => getKeyHash(tx.pubKey)),
        aggSignature,
        txs.map((tx) => tx.contractAddress),
        txs.map((tx) => tx.methodId),
        txs.map((tx) => tx.encodedParams),
      );

    return await txResponse.wait();
  }

  async getAggregatorBalance(): Promise<BigNumber> {
    return await this.erc20.balanceOf(
      env.DEPLOYER_ADDRESS,
    );
  }

  private static getAggregatorSigner() {
    const provider = new ethers.providers.JsonRpcProvider();
    const aggregatorSigner = new Wallet(env.PRIVATE_KEY_AGG, provider);

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
