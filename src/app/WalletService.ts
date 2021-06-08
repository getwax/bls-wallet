import { BigNumber, Contract, ethers, Wallet } from "../../deps/index.ts";

import * as env from "./env.ts";
import type { TransactionData } from "./TxService.ts";

export default class WalletService {
  // deno-lint-ignore no-explicit-any
  erc20ABI: any;
  // deno-lint-ignore no-explicit-any
  blsWalletABI: any;

  aggregatorSigner: Wallet;

  erc20?: Contract;
  blsWallet?: Contract;

  constructor() {
    const provider = new ethers.providers.JsonRpcProvider();
    this.aggregatorSigner = new Wallet(env.PRIVATE_KEY_AGG, provider);

    Deno.readTextFile("contractABIs/MockERC20.json").then((data) => {
      this.erc20ABI = JSON.parse(data).abi;
    });
    Deno.readTextFile("contractABIs/BLSWallet.json").then((data) => {
      this.blsWalletABI = JSON.parse(data).abi;
    });
  }

  setContractAddresses(
    addresses: { tokenAddress: string; blsWalletAddress: string },
  ) {
    this.erc20 = new Contract(
      addresses.tokenAddress,
      this.erc20ABI,
      this.aggregatorSigner,
    );

    this.blsWallet = new Contract(
      addresses.blsWalletAddress,
      this.blsWalletABI,
      this.aggregatorSigner,
    );
  }

  async sendTxs(txs: TransactionData[]) {
    await this.setContractAddresses({
      tokenAddress: env.TOKEN_ADDRESS,
      blsWalletAddress: "0xbCb5DDb58A2466e528047703233aCd0D29d36937",
    });
    const aggBalance: BigNumber = await this.erc20!.balanceOf(
      env.DEPLOYER_ADDRESS,
    );
    console.log(ethers.utils.formatUnits(aggBalance.toString(), 18));

    //TODO:
    console.log(`Send Txs (TODO) ${txs}`);
  }
}
