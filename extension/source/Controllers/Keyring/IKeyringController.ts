import { Bundle, Operation } from 'bls-wallet-clients';
import { BaseConfig, BaseState } from '../interfaces';
import { SafeEventEmitterProvider } from '../Network/INetworkController';

export type KeyPair = {
  /**
   * Hex string without 0x prefix
   */
  privateKey: string;
  /**
   * Address of the deployed contract wallet
   */
  address: string;
};

export interface KeyringControllerConfig extends BaseConfig {
  provider: SafeEventEmitterProvider;
}

export interface KeyringControllerState extends BaseState {
  wallets: KeyPair[];
  chainId: string;
}

export interface IKeyringController {
  /**
   * Returns the addresses of all stored key pairs
   */
  getAccounts(): string[];

  /**
   * Creates a new key pair
   */
  createAccount(): Promise<string>;

  /**
   * Imports a key pair
   * @param privateKey - Hex string without 0x prefix
   */
  importAccount(privateKey: string): Promise<string>;

  /**
   * Removes a key pair
   * @param address - Address of the key pair
   */
  removeAccount(address: string): void;

  /**
   * Signs a transaction of Type T
   * @param address - account to sign the tx with
   * @param tx - Transaction to sign
   */
  signTransactions(address: string, tx: Operation): Promise<Bundle>;
}
