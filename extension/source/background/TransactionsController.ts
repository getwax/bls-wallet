import * as io from 'io-ts';
import { windows, runtime } from 'webextension-polyfill';
import ensureType from '../helpers/ensureType';
import QuillStorageCells from '../QuillStorageCells';
import { PartialRpcImpl, RpcClient } from '../types/Rpc';
import assert from '../helpers/assert';
import TaskQueue from '../helpers/TaskQueue';
import RandomId from '../helpers/RandomId';
import isType from '../cells/isType';

export const TransactionStatus = io.union([
  io.literal('new'),
  io.literal('approved'),
  io.literal('rejected'),
  io.literal('cancelled'),
  io.literal('confirmed'),
  io.literal('failed'),
]);

export type TransactionStatus = io.TypeOf<typeof TransactionStatus>;

export const PromptMessage = io.type({
  id: io.string,
  result: io.union([io.literal('approved'), io.literal('rejected')]),
});

export type PromptMessage = io.TypeOf<typeof PromptMessage>;

export default class TransactionsController {
  constructor(
    public InternalRpc: () => RpcClient,
    public transactions: QuillStorageCells['transactions'],
    public selectedAddress: QuillStorageCells['selectedAddress'],
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    promptUser: async ({ params: [id] }) => {
      const cleanupTasks = new TaskQueue();

      const promptAction = new Promise<TransactionStatus>(
        (resolve, _reject) => {
          (async () => {
            const lastWin = await windows.getLastFocused();

            const popupWidth = 400;
            let left: number | undefined;

            if (lastWin.width !== undefined && lastWin.left !== undefined) {
              left = lastWin.left + lastWin.width - popupWidth - 20;
            }

            const popup = await windows.create({
              url: runtime.getURL(`confirm.html?id=${id}`),
              type: 'popup',
              width: popupWidth,
              height: 700,
              left,
            });

            cleanupTasks.push(() => {
              if (popup.id !== undefined) {
                windows.remove(popup.id);
              }
            });

            function onRemovedListener(windowId: number) {
              if (windowId === popup.id) {
                resolve('rejected');
              }
            }

            windows.onRemoved.addListener(onRemovedListener);

            cleanupTasks.push(() => {
              windows.onRemoved.removeListener(onRemovedListener);
            });

            function messageListener(message: unknown) {
              if (!isType(message, PromptMessage) || message.id !== id) {
                return;
              }

              resolve(message.result);
            }

            runtime.onMessage.addListener(messageListener);
          })();
        },
      );

      promptAction.finally(() => cleanupTasks.run());
      return promptAction;
    },

    createTransaction: async ({ params }) => {
      const id = RandomId();

      const newTransaction = {
        id,
        chainId: await this.InternalRpc().eth_chainId(),
        from: (await this.selectedAddress.read()) || '',
        createdAt: +new Date(),
        status: 'new',
        bundleHash: '',
        actions: params.map((p) => ({
          ...p,
          value: p.value || '0x0',
          gasPrice: p.gasPrice || '0x0',
        })),
      };

      const { outgoing: transactions } = await this.transactions.read();

      assert(
        transactions.every((t) => t.id !== id),
        () => new Error('Transaction already exists'),
      );

      transactions.push(newTransaction);
      await this.transactions.update({ outgoing: transactions });
      return id;
    },

    requestTransaction: async ({ params }) => {
      const id = await this.InternalRpc().createTransaction(...params);
      const result = await this.InternalRpc().promptUser(id);

      if (result === 'approved' || result === 'rejected') {
        await this.InternalRpc().updateTransactionStatus(id, result);
      }

      return result;
    },

    getTransactionById: async ({ params: [id] }) => {
      const { outgoing: transactions } = await this.transactions.read();
      const transaction = transactions.find((t) => t.id === id);

      if (transaction) {
        return transaction;
      }

      throw new Error('Transaction not found');
    },

    getTransactionByHash: async ({ params: [hash] }) => {
      const { outgoing: transactions } = await this.transactions.read();
      const transaction = transactions.find((t) => t.bundleHash === hash);

      if (transaction) {
        return transaction;
      }
      throw new Error('Transaction not found');
    },

    updateTransactionStatus: async ({ params: [id, status] }) => {
      const { outgoing: transactions } = await this.transactions.read();
      const transaction = transactions.find((t) => t.id === id);

      if (transaction) {
        switch (status) {
          // move to APPROVED or REJECTED only if status was NEW
          case 'approved':
            if (transaction?.status === 'new') {
              transaction.status = status;
            }
            break;
          case 'rejected':
            if (transaction?.status === 'new') {
              transaction.status = status;
            }
            break;
          // move to CANCELLED only if status was APPROVED
          case 'cancelled':
            if (transaction?.status === 'approved') {
              transaction.status = status;
            }
            break;
          // move to CONFIRM or FAILED only if status was APPROVED
          case 'confirmed':
            if (transaction?.status === 'approved') {
              transaction.status = status;
            }
            break;
          case 'failed':
            if (transaction?.status === 'approved') {
              transaction.status = status;
            }
            break;
          default:
            break;
        }

        const updatedTx = transactions.filter((t) => t.id !== id);
        updatedTx.push(transaction);
        await this.transactions.update({ outgoing: updatedTx });
      }
    },
  });
}
