import { BigNumber, Contract, ethers, Wallet } from "../../deps/index.ts";

import * as env from "./env.ts";
import contractABIs from "../../contractABIs/index.ts";
import type { TransactionData } from "./TxService.ts";

const erc20ABI = contractABIs["MockERC20.ovm.json"].abi;

export default class WalletService {
  aggregatorSigner: Wallet;
  erc20: Contract;

  constructor() {
    const provider = new ethers.providers.JsonRpcProvider();
    this.aggregatorSigner = new Wallet(env.PRIVATE_KEY_AGG, provider);

    this.erc20 = new Contract(
      env.TOKEN_ADDRESS,
      erc20ABI,
      this.aggregatorSigner,
    );
  }

  async sendTxs(txs: TransactionData[]) {
    await 0;
    console.log(`TODO: Send Txs: ${txs}`);
  }

  async getAggregatorBalance(): Promise<BigNumber> {
    return await this.erc20.balanceOf(
      env.DEPLOYER_ADDRESS,
    );
  }
}
