import ensureType from '../helpers/ensureType';
import QuillStorageCells from '../QuillStorageCells';
import { PartialRpcImpl, RpcClient } from '../types/Rpc';
import { v4 as uuidv4 } from 'uuid';
import assert from '../helpers/assert';
import { windows, runtime } from 'webextension-polyfill';
import TaskQueue from '../helpers/TaskQueue';
import getPropOrUndefined from '../helpers/getPropOrUndefined';

export enum TransactionStatus {
  'NEW' = 'new',
  'APPROVED' = 'approved',
  'REJECTED' = 'rejected',
  'CANCELLED' = 'cancelled',
  'CONFIRMED' = 'confirmed',
  'FAILED' = 'failed',
}

export default class TransactionsController {
  constructor(
    public InternalRpc: () => RpcClient,
    public transactions: QuillStorageCells['transactions'],
    public selectedAddress: QuillStorageCells['selectedAddress'],
  ) {}

  rpc = ensureType<PartialRpcImpl>()({
    promptUser: async ({ params: [id] }) => {
      const cleanupTasks = new TaskQueue();

      const promptAction = new Promise<string | undefined>(
        (resolve, _reject) => {
          (async () => {
            const lastWin = await windows.getLastFocused();

            const popupWidth = 359;
            let left: number | undefined;

            if (lastWin.width !== undefined && lastWin.left !== undefined) {
              left = lastWin.left + lastWin.width - popupWidth - 20;
            }

            const popup = await windows.create({
              url: runtime.getURL(`confirm.html?&id=${id}`),
              type: 'popup',
              width: popupWidth,
              height: 500,
              left,
            });

            cleanupTasks.push(() => {
              if (popup.id !== undefined) {
                windows.remove(popup.id);
              }
            });

            function onRemovedListener(windowId: number) {
              if (windowId === popup.id) {
                resolve(undefined);
              }
            }

            windows.onRemoved.addListener(onRemovedListener);

            cleanupTasks.push(() => {
              windows.onRemoved.removeListener(onRemovedListener);
            });

            function messageListener(message: unknown) {
              if (getPropOrUndefined(message, 'id') !== id) {
                return;
              }

              resolve(getPropOrUndefined(message, 'result') as string);
            }

            runtime.onMessage.addListener(messageListener);
          })();
        },
      );

      promptAction.finally(() => cleanupTasks.run());
      return promptAction;
    },

    createTransaction: async ({ params }) => {
      const id = uuidv4().toString();

      const newTransaction = {
        id,
        chainId: await this.InternalRpc().eth_chainId(),
        from: (await this.selectedAddress.read()) || '',
        createdAt: +new Date(),
        status: TransactionStatus.NEW,
        bundleHash: '',
        actions: params,
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

      if (
        result === TransactionStatus.APPROVED ||
        result === TransactionStatus.REJECTED
      ) {
        await this.InternalRpc().updateTransactionStatus(id, result);
      }
      return result;
    },

    getTransactionById: async ({ params: [id] }) => {
      const { outgoing: transactions } = await this.transactions.read();
      const transaction = transactions.find((t) => t.id === id);

      if (transaction) {
        return transaction;
      } else {
        throw new Error('Transaction not found');
      }
    },

    getTransactionByHash: async ({ params: [hash] }) => {
      const { outgoing: transactions } = await this.transactions.read();
      const transaction = transactions.find((t) => t.bundleHash === hash);

      if (transaction) {
        return transaction;
      } else {
        throw new Error('Transaction not found');
      }
    },

    updateTransactionStatus: async ({ params: [id, status] }) => {
      const transaction = await this.InternalRpc().getTransactionById(id);

      switch (status) {
        // move to APPROVED only if status was NEW
        case TransactionStatus.APPROVED || TransactionStatus.REJECTED:
          if (transaction.status === TransactionStatus.NEW) {
            transaction.status = status;
          }
          break;
        // move to CANCELLED only if status was APPROVED
        case TransactionStatus.CANCELLED:
          if (transaction.status === TransactionStatus.APPROVED) {
            transaction.status = status;
          }
          break;
        // move to CONFIRM or FAILED only if status was APPROVED
        case TransactionStatus.CONFIRMED || TransactionStatus.FAILED:
          if (transaction.status === TransactionStatus.APPROVED) {
            transaction.status = status;
          }
          break;
      }
    },
  });
}
