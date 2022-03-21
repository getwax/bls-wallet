import { JRPCRequest } from '@toruslabs/openlogin-jrpc';
import { TxData } from '@ethereumjs/tx';

import { BaseConfig, BaseState } from '../interfaces';

/**
 * The status of the transaction. Each status represents the state of the transaction internally
 * in the wallet. Some of these correspond with the state of the transaction on the network, but
 * some are wallet-specific.
 */

export enum TransactionStatus {
  approved = 'approved',
  cancelled = 'cancelled',
  confirmed = 'confirmed',
  failed = 'failed',
  finalized = 'finalized',
  processed = 'processed',
  rejected = 'rejected',
  signed = 'signed',
  submitted = 'submitted',
  unapproved = 'unapproved',
  dropped = 'dropped',
}

export const TRANSACTION_TYPES = {
  CONTRACT_INTERACTION: 'contractInteraction',
  DEPLOY_CONTRACT: 'contractDeployment',
  STANDARD_TRANSACTION: 'transaction',
  STANDARD_PAYMENT_TRANSACTION: 'payment_transaction', // specific to chains like solana and casper
};

export type TransactionType =
  typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

export const TX_EVENTS = {
  TX_WARNING: 'tx:warning',
  TX_ERROR: 'tx:error',
  TX_FAILED: 'tx:failed',
  TX_CONFIRMED: 'tx:confirmed',
  TX_DROPPED: 'tx:dropped',
  TX_EXPIRED: 'tx:expired',
  TX_STATUS_UPDATE: 'tx:status_update',
  TX_UNAPPROVED: 'tx:unapproved',
};

export interface TransactionMeta {
  id: string;
  from: string;
  transaction: TxData;
  transactionType: TransactionType;
  dappSuggestedTransaction: Partial<TxData>;
  chainId: string;
  origin: string;
  time: number;
  status: TransactionStatus;
  updated_at?: string; // iso date string
  transactionHash?: string;
  rawTransaction?: string;
  txReceipt?: unknown;
  error?: Error;
  warning?: {
    error?: string;
    message?: string;
  };
}

export type BaseTxEventType = {
  txId: string;
};

export type TxErrorEventType = BaseTxEventType & {
  error: Error;
};

export type TxFailedEventType = BaseTxEventType & {
  error: Error;
};

export type TxExpiredEventType = BaseTxEventType;

export type TxWarningEventType = BaseTxEventType & {
  txMeta: TransactionMeta;
};

export type TxConfirmedEventType = BaseTxEventType & {
  txReceipt: unknown;
};

export type TxDroppedEventType = BaseTxEventType;

export type TxStatusUpdateEventType = BaseTxEventType & {
  status: TransactionStatus;
};

export type TxFinishedEventType = BaseTxEventType & {
  txMeta: TransactionMeta;
};

/**
 * Transaction controller configuration
 */
export interface TransactionConfig extends BaseConfig {
  txHistoryLimit: number;
}

/**
 * Transaction controller state
 */
export interface TransactionState extends BaseState {
  /**
   * Transactions by key (id) value (TxMeta)
   */
  transactions: Record<string, TransactionMeta>; // all transactions (unapprroved and all others)
  unapprovedTxs?: Record<string, TransactionMeta>; // only unapproved
  currentNetworkTxsList?: TransactionMeta[];
}

/**
 * Result
 *
 * result - Promise resolving to a new transaction hash
 * transactionMeta - Meta information about this new transaction
 */
export interface Result {
  result: Promise<string>;
  transactionMeta: TransactionMeta;
}

export interface ITransactionController {
  /**
   * Add a new unapproved transaction to state.
   * @param transaction - Transaction object to add
   * @returns - Object containing a promise resolving to the transaction hash if approved
   */
  addTransaction(
    transaction: TxData,
    req: JRPCRequest<TxData & { windowId?: string }> & { origin: string },
  ): Promise<Result>;

  /**
   * Approves a transaction and updates it's status in state.
   *
   * @param transactionID - ID of the transaction to approve
   * @returns - Promise resolving when this operation completes
   */
  approveTransaction(transactionID: string): Promise<void>;

  /**
   * Cancels a transaction based on its ID by setting its status to "rejected"
   *
   * @param transactionID - ID of the transaction to cancel
   */
  cancelTransaction?(transactionID: string): Promise<void>;
}

export interface ITransactionStateManager {
  addTransactionToState(txMeta: TransactionMeta): TransactionMeta;

  wipeTransactions(address: string): void;

  getTransactions(args: {
    searchCriteria?:
      | Record<string, (val: unknown) => boolean>
      | Record<string, unknown>;
    initialList?: TransactionMeta[];
    filterToCurrentNetwork?: boolean;
  }): TransactionMeta[];
  getApprovedTransactions(address?: string): TransactionMeta[];
  getPendingTransactions(address?: string): TransactionMeta[];
  getConfirmedTransactions(address?: string): TransactionMeta[];
}
