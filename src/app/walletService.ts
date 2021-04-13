import { dotEnvConfig } from './deps.ts';

import {
  ethers,
  Contract,
  Wallet
} from "https://cdn.ethers.io/lib/ethers-5.0.esm.min.js";

import type { TransactionData } from './txService.ts'

class WalletService {

  erc20ABI: any;
  blsWalletABI: any;

  aggregatorSigner: Wallet;

  erc20?: Contract;
  blsWallet?: Contract;

  constructor() {
    const provider = new ethers.providers.JsonRpcProvider();
    dotEnvConfig({ export: true });
    this.aggregatorSigner = new Wallet(`${Deno.env.get("PRIVATE_KEY_AGG")}`, provider);

    Deno.readTextFile("contractABIs/MockERC20.json").then(data => {
      this.erc20ABI = JSON.parse(data).abi;
    })
    Deno.readTextFile("contractABIs/BLSWallet.json").then(data => {
      this.blsWalletABI = JSON.parse(data).abi;
    })
  }

  setContractAddresses(addresses: {tokenAddress: string, blsWalletAddress: string}) {
    this.erc20 = new Contract(
      addresses.tokenAddress,
      this.erc20ABI,
      this.aggregatorSigner
    );

    this.blsWallet = new Contract(
      addresses.blsWalletAddress,
      this.blsWalletABI,
      this.aggregatorSigner
    );
  }

  async sendTxs(txs: TransactionData[]) {
    //TODO:
    console.log(`Send Txs (TODO) ${txs}`);
  }

}

export default new WalletService();
