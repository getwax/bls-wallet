import { keyBy, mapValues, omitBy, pickBy, sortBy } from 'lodash-es';

import BaseController from '../BaseController';
import { transactionMatchesNetwork } from '../utils';
import {
  TransactionConfig,
  TransactionMeta,
  TransactionState,
  TransactionStatus,
  TX_EVENTS,
  TxStatusUpdateEventType,
} from './ITransactionController';

export class BaseTransactionStateManager extends BaseController<
  TransactionConfig,
  TransactionState
> {
  protected getCurrentChainId: () => string;

  constructor({
    config,
    state,
    getCurrentChainId,
  }: {
    config?: Partial<TransactionConfig>;
    state?: Partial<TransactionState>;
    getCurrentChainId: () => string;
  }) {
    super({ config, state });
    this.defaultConfig = {
      txHistoryLimit: 40,
    };
    this.defaultState = {
      transactions: {},
      unapprovedTxs: {},
      currentNetworkTxsList: [],
    };
    this.initialize();
    this.getCurrentChainId = getCurrentChainId;
  }

  getUnapprovedTxList(): Record<string, TransactionMeta> {
    const chainId = this.getCurrentChainId();
    return pickBy(
      this.state.transactions,
      (transaction) =>
        transaction.status === TransactionStatus.unapproved &&
        transactionMatchesNetwork(transaction, chainId),
    );
  }

  getTransaction(txId: string): TransactionMeta {
    const { transactions } = this.state;
    return transactions[txId];
  }

  updateTransaction(txMeta: TransactionMeta): void {
    // commit txMeta to state
    const txId = txMeta.id;
    txMeta.updated_at = new Date().toISOString();
    this.update({
      transactions: {
        ...this.state.transactions,
        [txId]: txMeta,
      },
    });
  }

  setTxStatusRejected(txId: string): void {
    this._setTransactionStatus(txId, TransactionStatus.rejected);
    this._deleteTransaction(txId);
  }

  /**
   * The implementing controller can override this functionality and add custom logic + call super.()
   */
  setTxStatusUnapproved(txId: string): void {
    this._setTransactionStatus(txId, TransactionStatus.unapproved);
  }

  setTxStatusApproved(txId: string): void {
    this._setTransactionStatus(txId, TransactionStatus.approved);
  }

  setTxStatusSigned(txId: string): void {
    this._setTransactionStatus(txId, TransactionStatus.signed);
  }

  setTxStatusSubmitted(txId: string): void {
    this._setTransactionStatus(txId, TransactionStatus.submitted);
  }

  setTxStatusDropped(txId: string): void {
    this._setTransactionStatus(txId, TransactionStatus.dropped);
  }

  setTxStatusConfirmed(txId: string): void {
    this._setTransactionStatus(txId, TransactionStatus.confirmed);
  }

  setTxStatusFailed(txId: string, error_: Error): void {
    const error = !error_ ? new Error('Internal torus failure') : error_;

    const txMeta = this.getTransaction(txId);
    txMeta.error = error;
    this.updateTransaction(txMeta);
    this._setTransactionStatus(txId, TransactionStatus.failed);
  }

  /**
   * Method to determine if the transaction is in a final state
   * @param status - Transaction status
   * @returns boolean if the transaction is in a final state
   */
  isFinalState(status: TransactionStatus): boolean {
    return (
      status === TransactionStatus.rejected ||
      status === TransactionStatus.submitted ||
      status === TransactionStatus.confirmed ||
      status === TransactionStatus.failed ||
      status === TransactionStatus.cancelled
    );
  }

  /**
   * Filters out the unapproved transactions from state
   */
  clearUnapprovedTxs(): void {
    this.update({
      transactions: omitBy(
        this.state.transactions,
        (transaction: TransactionMeta) =>
          transaction.status === TransactionStatus.unapproved,
      ),
    });
  }

  /**
   * will append new transactions to old txns.
   */
  _addTransactionsToState(transactions: TransactionMeta[]): void {
    this.update({
      transactions: transactions.reduce(
        (result: Record<string, TransactionMeta>, newTx: TransactionMeta) => {
          result[newTx.id] = newTx;
          return result;
        },
        this.state.transactions,
      ),
    });
  }

  /**
   * will set new txns, override existing if any in state.
   */
  _setTransactionsToState(transactions: TransactionMeta[]): void {
    this.update({
      transactions: transactions.reduce(
        (result: Record<string, TransactionMeta>, newTx: TransactionMeta) => {
          result[newTx.id] = newTx;
          return result;
        },
        {},
      ),
    });
  }

  _deleteTransaction(targetTransactionId: string): void {
    const { transactions } = this.state;
    delete transactions[targetTransactionId];
    this.update({
      transactions,
    });
  }

  _deleteTransactions(targetTransactionIds: string[]): void {
    const { transactions } = this.state;
    targetTransactionIds.forEach((transactionId) => {
      delete transactions[transactionId];
    });
    this.update({
      transactions,
    });
  }

  protected _setTransactionStatus(
    txId: string,
    status: TransactionStatus,
  ): void {
    const txMeta = this.getTransaction(txId);
    if (!txMeta) {
      return;
    }
    txMeta.status = status;
    // only updating status so no validation required on txn.
    this.updateTransaction(txMeta);
    this.emit(TX_EVENTS.TX_STATUS_UPDATE, {
      txId,
      status,
    } as TxStatusUpdateEventType);
    if (this.isFinalState(status)) {
      this.emit(`${txMeta.id}:finished`, txMeta);
    } else {
      this.emit(`${txMeta.id}:${status}`, txId);
    }
  }

  wipeTransactions(address: string): void {
    const { transactions } = this.state;
    const chainId = this.getCurrentChainId();

    this.update({
      transactions: omitBy(
        transactions,
        (txMeta: TransactionMeta) =>
          txMeta.from === address && transactionMatchesNetwork(txMeta, chainId),
      ),
    });
  }

  getTransactions({
    searchCriteria = {},
    initialList = undefined,
    filterToCurrentNetwork = true,
  }: {
    searchCriteria?:
      | Record<string, (val: unknown) => boolean>
      | Record<string, unknown>;
    initialList?: TransactionMeta[];
    filterToCurrentNetwork?: boolean;
  } = {}): TransactionMeta[] {
    const chainId = this.getCurrentChainId();
    // searchCriteria is an object that might have values that aren't predicate
    // methods. When providing any other value type (string, number, etc), we
    // consider this shorthand for "check the value at key for strict equality
    // with the provided value". To conform this object to be only methods, we
    // mapValues (lodash) such that every value on the object is a method that
    // returns a boolean.
    const predicateMethods: unknown = mapValues(searchCriteria, (predicate) =>
      typeof predicate === 'function' ? predicate : (v: any) => v === predicate,
    );

    // If an initial list is provided we need to change it back into an object
    // first, so that it matches the shape of our state. This is done by the
    // lodash keyBy method. This is the edge case for this method, typically
    // initialList will be undefined.
    const transactionsToFilter = initialList
      ? keyBy(initialList, 'id')
      : this.state.transactions;

    // Combine sortBy and pickBy to transform our state object into an array of
    // matching transactions that are sorted by time.
    const filteredTransactions = sortBy(
      pickBy(transactionsToFilter, (txMeta: TransactionMeta) => {
        // default matchesCriteria to the value of transactionMatchesNetwork
        // when filterToCurrentNetwork is true.
        if (
          filterToCurrentNetwork &&
          transactionMatchesNetwork(txMeta, chainId) === false
        ) {
          return false;
        }
        // iterate over the predicateMethods keys to check if the transaction
        // matches the searchCriteria
        // for (const [key, predicate] of Object.entries(predicateMethods)) {
        //   // We return false early as soon as we know that one of the specified
        //   // search criteria do not match the transaction. This prevents
        //   // needlessly checking all criteria when we already know the criteria
        //   // are not fully satisfied. We check both txParams and the base
        //   // object as predicate keys can be either.
        //   let searchObj = {};
        //   const txHeader = txMeta.transaction?.deploy?.header;
        //   if (key in txMeta) {
        //     searchObj = txMeta[key];
        //   } else if (key in txMeta.transaction) {
        //     searchObj = txMeta.transaction[key];
        //   } else if (txHeader && key in txHeader) {
        //     searchObj = txMeta.transaction?.deploy?.header[key];
        //   }
        //   if (Object.keys(searchObj).length === 0 || !predicate(searchObj)) {
        //     return false;
        //   }
        // }

        return true;
      }),
      'time',
    );
    return filteredTransactions;
  }

  getApprovedTransactions(address?: string): TransactionMeta[] {
    const searchCriteria: { status: TransactionStatus; account?: string } = {
      status: TransactionStatus.approved,
    };
    if (address) {
      searchCriteria.account = address;
    }
    return this.getTransactions({ searchCriteria });
  }

  getSubmittedTransactions(address?: string): TransactionMeta[] {
    const searchCriteria: { status: TransactionStatus; account?: string } = {
      status: TransactionStatus.submitted,
    };
    if (address) {
      searchCriteria.account = address;
    }
    return this.getTransactions({ searchCriteria });
  }

  getPendingTransactions(address?: string): TransactionMeta[] {
    const submitted = this.getSubmittedTransactions(address);
    const approved = this.getApprovedTransactions(address);
    return [...submitted, ...approved];
  }

  getConfirmedTransactions(address?: string): TransactionMeta[] {
    const searchCriteria: { status: TransactionStatus; account?: string } = {
      status: TransactionStatus.confirmed,
    };
    if (address) {
      searchCriteria.account = address;
    }
    return this.getTransactions({ searchCriteria });
  }

  getTransactionsByHash(hash: string): Record<string, TransactionMeta> {
    const chainId = this.getCurrentChainId();
    const transactions = pickBy(
      this.state.transactions,
      (transaction) =>
        transaction.transactionHash === hash &&
        transactionMatchesNetwork(transaction, chainId),
    );
    return transactions;
  }

  addTransactionToState(txMeta: TransactionMeta): TransactionMeta {
    this.on(`${txMeta.id}:signed`, () => {
      this.removeAllListeners(`${txMeta.id}:rejected`);
    });
    this.on(`${txMeta.id}:rejected`, () => {
      this.removeAllListeners(`${txMeta.id}:signed`);
    });
    this._addTransactionsToState([txMeta]);
    const transactions = this.getTransactions({
      filterToCurrentNetwork: false,
    });
    const txToKeep = this.trimTransactionsForState(transactions);
    this._setTransactionsToState([...txToKeep]);
    this.emit(`${txMeta.id}:unapproved`, txMeta);
    return txMeta;
  }

  /**
   * Trim the amount of transactions that are set on the state. Checks
   * if the length of the tx history is longer then desired persistence
   * limit and then if it is removes the oldest confirmed, rejected, failed, expired tx.
   * Pending or unapproved transactions will not be removed by this
   * operation. For safety of presenting a fully functional transaction UI
   * representation, this function will not break apart transactions with the
   * same id, created on the same day, per network. Not accounting for transactions of the same
   * nonce, same day and network combo can result in confusing or broken experiences
   * in the UI. The transactions are then updated using the BaseController update.
   * @param transactions - arrray of transactions to be applied to the state
   * @returns Array of TransactionMeta with the desired length.
   */
  private trimTransactionsForState(
    transactions: TransactionMeta[],
  ): TransactionMeta[] {
    const txhashNetworkSet = new Set();
    const txsToKeep = transactions.reverse().filter((tx: TransactionMeta) => {
      const { chainId, status, transaction, time, transactionHash } = tx;
      if (transaction) {
        const key = `${transactionHash}-${chainId}-${new Date(
          time,
        ).toDateString()}`;
        if (txhashNetworkSet.has(key)) {
          return false;
        }
        if (
          txhashNetworkSet.size < this.config.txHistoryLimit ||
          !this.isFinalState(status)
        ) {
          txhashNetworkSet.add(key);
          return true;
        }
      }
      return false;
    });
    txsToKeep.reverse();
    return txsToKeep;
  }
}
