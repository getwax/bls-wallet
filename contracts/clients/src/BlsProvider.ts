import { JsonRpcProvider } from "@ethersproject/providers";
import {
  TransactionReceipt,
  Log,
} from "@ethersproject/abstract-provider";
import { BigNumber } from "@ethersproject/bignumber";
import { Networkish } from "@ethersproject/networks";
import { parseEther } from "@ethersproject/units";
import { ContractReceipt } from "@ethersproject/contracts";

import Aggregator, { BundleReceipt } from "./Aggregator";
import BlsSigner from "./BlsSigner";
import { _constructorGuard } from "./BlsSigner";

// interface BundleReceipt extends ContractReceipt {
//   to: string;
//   from: string;
//   contractAddress: string;
//   transactionIndex: number;
//   root?: string;
//   gasUsed: BigNumber;
//   logsBloom: string;
//   blockHash: string;
//   transactionHash: string;
//   logs: Array<Log>;
//   blockNumber: number;
//   confirmations: number;
//   cumulativeGasUsed: BigNumber;
//   effectiveGasPrice: BigNumber;
//   byzantium: boolean;
//   type: number;
//   status?: number;
// }

export default class BlsProvider extends JsonRpcProvider {
  readonly aggregator: Aggregator;

  constructor(
    readonly aggregatorUrl: string,
    url: string,
    network: Networkish,
  ) {
    super(url, network);
    this.aggregator = new Aggregator(aggregatorUrl);
  }

  getSigner(addressOrIndex?: string | number): BlsSigner {
    return new BlsSigner(_constructorGuard, this, addressOrIndex);
  }


  async waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number,
  ): Promise<TransactionReceipt> {
    return this._waitForTransaction(
      transactionHash,
      confirmations == null ? 1 : confirmations,
      timeout || 0,
    );
  }

  async _waitForTransaction(
    transactionHash: string,
    confirmations: number,
    timeout: number,
  ): Promise<TransactionReceipt> {
    let bundleReceipt: BundleReceipt | undefined;
    const aggregator = this.aggregator;

    async function poll(fn: Function, fnCondition: Function, ms: number) {
      let result = await fn();
      while (fnCondition(result)) {
        await wait(ms);
        result = await fn();
      }
      return result;
    }

    function wait(ms = 1000) {
      return new Promise((resolve) => {
        console.log(`waiting ${ms} ms...`);
        setTimeout(resolve, ms);
      });
    }

    let getBundleReceipt = async () =>
      await aggregator.lookupReceipt(transactionHash);
    let bundleExists = (result: BundleReceipt) => !result?.transactionHash;
    bundleReceipt = await poll(getBundleReceipt, bundleExists, 3000);

    // TODO: ERROR HANDLING
    if (bundleReceipt === undefined) {
      throw new Error("Could not find bundle receipt");
    }

    return {
      to: "0x",
      from: "0x",
      contractAddress: "0x",
      transactionIndex: parseInt(bundleReceipt.transactionIndex),
      gasUsed: parseEther("0"),
      logsBloom: "",
      blockHash: bundleReceipt.blockHash,
      transactionHash: bundleReceipt.transactionHash,
      logs: [],
      blockNumber: parseInt(bundleReceipt.blockNumber),
      confirmations: 1,
      cumulativeGasUsed: parseEther("0"),
      effectiveGasPrice: parseEther("0"),
      byzantium: false,
      type: 1,
    };
    // return {
    //   to: bundleReceipt.to,
    //   from: bundleReceipt.from,
    //   contractAddress: bundleReceipt.contractAddress,
    //   transactionIndex: bundleReceipt.transactionIndex,
    //   gasUsed: bundleReceipt.gasUsed,
    //   logsBloom: bundleReceipt.logsBloom,
    //   blockHash: bundleReceipt.blockHash,
    //   transactionHash: bundleReceipt.transactionHash,
    //   logs: bundleReceipt.logs,
    //   blockNumber: bundleReceipt.blockNumber,
    //   confirmations: bundleReceipt.confirmations,
    //   cumulativeGasUsed: bundleReceipt.cumulativeGasUsed,
    //   effectiveGasPrice: bundleReceipt.effectiveGasPrice,
    //   byzantium: bundleReceipt.byzantium,
    //   type: bundleReceipt.type,
    // };
  }
}
