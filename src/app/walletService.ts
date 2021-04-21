import { dotEnvConfig } from "./deps.ts";

import type { TransactionData } from "./txService.ts";

import { BigNumber, Contract, ethers, Wallet } from "./deps.ts";

/// Workaround to call any function on a Contract object (via generic ContractFunction from ethers)
// deno-lint-ignore no-explicit-any
declare type ContractFunction = (...params: Array<any>) => Promise<any>;
interface IContract {
  // deno-lint-ignore no-explicit-any
  readonly [name: string]: ContractFunction | any;
}

class WalletService {
  // deno-lint-ignore no-explicit-any
  erc20ABI: any;
  // deno-lint-ignore no-explicit-any
  blsWalletABI: any;

  aggregatorSigner: Wallet;

  erc20?: IContract;
  blsWallet?: IContract;

  constructor() {
    const provider = new ethers.providers.JsonRpcProvider(null, null);
    dotEnvConfig({ export: true });
    this.aggregatorSigner = new Wallet(
      `${Deno.env.get("PRIVATE_KEY_AGG")}`,
      provider,
    );

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
    ) as unknown as IContract;

    this.blsWallet = new Contract(
      addresses.blsWalletAddress,
      this.blsWalletABI,
      this.aggregatorSigner,
    ) as unknown as IContract;
  }

  async sendTxs(txs: TransactionData[]) {
    await this.setContractAddresses({
      tokenAddress: "0x6F714e7b5a7F0913038664d932e8acd6fDf1Ad55",
      blsWalletAddress: "0xbCb5DDb58A2466e528047703233aCd0D29d36937",
    });
    const aggBalance: BigNumber = await this.erc20!.balanceOf(
      "0xF28eA4691841aD169DaCeA9E1aE13BE34F55F149",
    );
    console.log(ethers.utils.formatUnits(aggBalance.toString(), 18));

    //TODO:
    console.log(`Send Txs (TODO) ${txs}`);
  }
}

export default new WalletService();
