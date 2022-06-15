import { Bundle, Operation } from 'bls-wallet-clients';

export interface IKeyringController {
  /**
   * Returns the addresses of all stored key pairs
   */
  getAccounts(): Promise<string[]>;

  /**
   * Creates a new key pair
   */
  createAccount(): Promise<string>;

  /**
   * Creates a Deterministic Account based on seed phrase
   */
  createHDAccount(): Promise<string>;

  /**
   * Imports a key pair
   * @param privateKey - Hex string without 0x prefix
   */
  importAccount(privateKey: string): Promise<string>;

  /**
   * Removes a key pair
   * @param address - Address of the key pair
   */
  removeAccount(address: string): Promise<void>;

  /**
   * Signs a transaction of Type T
   * @param address - account to sign the tx with
   * @param tx - Transaction to sign
   */
  signTransactions(address: string, tx: Operation): Promise<Bundle>;
}
