import * as io from 'io-ts';
import { Bundle, Operation } from 'bls-wallet-clients';

export const KeyPair = io.type({
  /**
   * Hex string without 0x prefix
   */
  privateKey: io.string,
  /**
   * Address of the deployed contract wallet
   */
  address: io.string,
});

export type KeyPair = io.TypeOf<typeof KeyPair>;

export const KeyringControllerState = io.type({
  HDPhrase: io.union([io.undefined, io.string]),
  wallets: io.array(KeyPair),
  chainId: io.union([io.undefined, io.string]),
});

export type KeyringControllerState = io.TypeOf<typeof KeyringControllerState>;

export const defaultKeyringControllerState: KeyringControllerState = {
  HDPhrase: undefined,
  wallets: [],
  chainId: undefined,
};

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
