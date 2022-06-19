import { Aggregator } from 'bls-wallet-clients';
import { AGGREGATOR_URL } from '../env';
import ensureType from '../helpers/ensureType';
import { PartialRpcImpl, SendTransactionParams } from '../types/Rpc';
import KeyringController from './KeyringController';
import NetworkController from './NetworkController';

export default class AggregatorController {
  // This is just kept in memory because it supports setting the preferred
  // aggregator for the particular provider only.
  preferredAggregators: Record<string, string> = {};

  knownTransactions: Record<
    string,
    | (SendTransactionParams & {
        nonce: string;
        value: string;
        aggregatorUrl: string;
      })
    | undefined
  > = {};

  constructor(
    public networkController: NetworkController,
    public keyringController: KeyringController,
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    eth_sendTransaction: async ({ providerId, params }) => {
      // FIXME: We should not be assuming that the first from is the same as all
      // the other froms!
      // Supporting multiple froms is actually super awesome - we can show off
      // client-side aggregation and implement contractless transaction pairs
      // (or rings!), ie account A sends asset X in exchange for account B
      // sending asset Y
      const { from } = params[0];

      const actions = params.map((tx) => {
        return {
          ethValue: tx.value ?? '0',
          contractAddress: tx.to,
          encodedFunction: tx.data,
        };
      });

      const wallet = await this.keyringController.lookupWallet(from);
      const nonce = (await wallet.Nonce()).toString();
      const bundle = await wallet.sign({ nonce, actions });

      const aggregatorUrl =
        this.preferredAggregators[providerId] ?? AGGREGATOR_URL;
      const agg = new Aggregator(aggregatorUrl);
      const result = await agg.add(bundle);

      if ('failures' in result) {
        throw new Error(JSON.stringify(result.failures));
      }

      this.knownTransactions[result.hash] = {
        ...params[0],
        nonce,
        value: params[0].value ?? '0',
        aggregatorUrl,
      };

      return result.hash;
    },
    eth_getTransactionByHash: async ({ params: [hash] }) => {
      const knownTx = this.knownTransactions[hash];

      if (knownTx === undefined) {
        return undefined;
      }

      // Here we're just relaying the information that we already know
      // internally about the transaction. ethers needs this response to
      // function properly.
      return {
        hash,
        from: knownTx.from,
        nonce: knownTx.nonce,
        value: knownTx.value,
        gasLimit: '0x0',
        data: knownTx.data,
      };
    },
    eth_getTransactionReceipt: async ({ params: [hash] }) => {
      const knownTx = this.knownTransactions[hash];

      if (knownTx === undefined) {
        return undefined;
      }

      const aggregator = new Aggregator(knownTx.aggregatorUrl);
      const bundleReceipt = await aggregator.lookupReceipt(hash);

      if (bundleReceipt === undefined) {
        // TODO: Indicate that we've taken responsibility here so that
        // QuillController doesn't defer to the network
        return undefined;
      }

      return {
        transactionHash: hash,
        transactionIndex: bundleReceipt.transactionIndex,
        blockHash: bundleReceipt.blockHash,
        blockNumber: bundleReceipt.blockNumber,
        from: knownTx.from,
        to: knownTx.to,
        logs: [],
        cumulativeGasUsed: '0x0',
        gasUsed: '0x0',
        status: '0x1',
        effectiveGasPrice: '0x0',
      };
    },
    eth_setPreferredAggregator: async ({
      providerId,
      params: [preferredAggregator],
    }) => {
      this.preferredAggregators[providerId] = preferredAggregator;

      return 'ok';
    },
  });
}