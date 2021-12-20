import { BaseConfig, BaseState } from '../interfaces';

export type PrivateKey = string;
export type PublicKey = string;

export type Wallet = {
  privateKey: PrivateKey;
  publicKey: PublicKey;
};

/**
 * Available keyring types
 */
export enum KeyringTypes {
  simple = 'Simple Key Pair',
}

/**
 * A strategy for importing an account
 */
export enum AccountImportStrategy {
  privateKey = 'privateKey',
}

/**
 * @type KeyringObject
 *
 * Keyring object
 * @property type - Keyring type
 * @property accounts - Associated accounts
 * @function getAccounts - Get associated accounts
 */
export interface KeyringObject {
  type: string;
  accounts: string[];
  getAccounts(): string[];
}

/**
 * @type KeyringState
 *
 * Keyring controller state
 * @property vault - Encrypted string representing keyring data
 * @property keyrings - Group of accounts
 */
export interface KeyringState extends BaseState {
  vault?: string;
  keyrings: Keyring[];
}

/**
 * @type KeyringMemState
 *
 * Keyring mem controller state
 * @property isUnlocked - Whether vault is unlocked
 * @property keyringTypes - Account types
 * @property keyrings - Group of accounts
 */
export interface KeyringMemState extends BaseState {
  isUnlocked: boolean;
  keyringTypes: string[];
  keyrings: Keyring[];
}

/**
 * @type KeyringConfig
 *
 * Keyring controller configuration
 * @property encryptor - Keyring encryptor
 */
export interface KeyringConfig extends BaseConfig {
  encryptor?: any;
}

/**
 * @type Keyring
 *
 * Keyring object to return in fullUpdate
 * @property type - Keyring type
 * @property accounts - Associated accounts
 * @property index - Associated index
 */
export interface Keyring {
  accounts: string[];
  type: string;
  index?: number;
}
