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

  createWalletContract(address: string) {
    return new Contract(
      address,
      contractABIs["BLSWallet.ovm.json"].abi,
      this.aggregatorSigner,
    );
  }

  async sendTxs(txs: TransactionData[]) {
    const aggBalance: BigNumber = await this.erc20!.balanceOf(
      env.DEPLOYER_ADDRESS,
    );
    console.log(ethers.utils.formatUnits(aggBalance.toString(), 18));

    //TODO:
    console.log(`Send Txs (TODO) ${txs}`);
  }
}
