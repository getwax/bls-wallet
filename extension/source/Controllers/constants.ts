import * as io from 'io-ts';

import toHex from '../helpers/toHex';

export const CHAINS = {
  ARBITRUM_RINKEBY: 'arbitrum-rinkeby',
  ARBITRUM: 'arbitrum',
  OPTIMISM_KOVAN: 'optimism-kovan',
  OPTIMISM: 'optimism',
  LOCAL: 'local',
};

export const CHAINIDS = {
  ARBITRUM_RINKEBY: toHex(421611),
  ARBITRUM: toHex(42161),
  OPTIMISM_KOVAN: toHex(69),
  OPTIMISM: toHex(10),
  LOCAL: toHex(31337),
};

export const ProviderConfig = io.type({
  /**
   * Block explorer url for the chain
   * @example https://ropsten.etherscan.io
   */
  blockExplorerUrl: io.string,
  /**
   * Logo url for the base token
   */
  logo: io.string,
  /**
   * Name for ticker
   * @example 'Binance Token', 'Ethereum', 'Matic Network Token'
   */
  tickerName: io.string,
  /**
   * Symbol for ticker
   * @example BNB, ETH
   */
  ticker: io.string,
  /**
   * RPC target Url for the chain
   * @example https://ropsten.infura.io/v3/YOUR_API_KEY
   */
  rpcTarget: io.string,
  /**
   * Chain Id parameter(hex with 0x prefix) for the network. Mandatory for all networks. (assign one with a map to network identifier for platforms)
   * @example 0x1 for mainnet, 'loading' if not connected to anything yet or connection fails
   * @defaultValue 'loading'
   */
  chainId: io.string,
  /**
   * Display name for the network
   */
  displayName: io.string,

  /**
   * Unique key for network (used for infura)
   */
  networkKey: io.string,
});

export type ProviderConfig = io.TypeOf<typeof ProviderConfig>;

export const CHAIN_ID_NETWORK_MAP = {
  [CHAINIDS.ARBITRUM_RINKEBY]: CHAINS.ARBITRUM_RINKEBY,
  [CHAINIDS.ARBITRUM]: CHAINS.ARBITRUM,
  [CHAINIDS.OPTIMISM_KOVAN]: CHAINS.OPTIMISM_KOVAN,
  [CHAINIDS.OPTIMISM]: CHAINS.OPTIMISM,
  [CHAINIDS.LOCAL]: CHAINS.LOCAL,
};

export const SUPPORTED_NETWORKS: Record<string, ProviderConfig> = {
  [CHAINS.ARBITRUM_RINKEBY]: {
    blockExplorerUrl: 'https://rinkeby-explorer.arbitrum.io',
    chainId: CHAINIDS.ARBITRUM_RINKEBY,
    displayName: 'Arbitrum Test Network',
    logo: '',
    rpcTarget: 'https://rinkeby.arbitrum.io/rpc',
    ticker: 'ARETH',
    tickerName: 'Arbitrum Ethereum',
    networkKey: CHAINS.ARBITRUM_RINKEBY,
  },
  [CHAINS.ARBITRUM]: {
    blockExplorerUrl: 'https://explorer.arbitrum.io',
    chainId: CHAINIDS.ARBITRUM,
    displayName: 'Arbitrum One',
    logo: '',
    rpcTarget: `https://arb1.arbitrum.io/rpc`,
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: CHAINS.ARBITRUM,
  },
  [CHAINS.OPTIMISM_KOVAN]: {
    blockExplorerUrl: 'https://kovan-optimistic.etherscan.io',
    chainId: CHAINIDS.OPTIMISM_KOVAN,
    displayName: 'Optimism Test Network',
    logo: '',
    rpcTarget: 'https://kovan.optimism.io',
    ticker: 'KOR',
    tickerName: '?',
    networkKey: CHAINS.OPTIMISM_KOVAN,
  },
  [CHAINS.OPTIMISM]: {
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    chainId: CHAINIDS.OPTIMISM,
    displayName: 'Optimism',
    logo: '',
    rpcTarget: 'https://mainnet.optimism.io',
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: CHAINS.OPTIMISM,
  },
  [CHAINS.LOCAL]: {
    blockExplorerUrl: 'N/A',
    chainId: CHAINIDS.LOCAL,
    displayName: 'Local Network',
    logo: '',
    rpcTarget: 'http://localhost:8545',
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: CHAINS.LOCAL,
  },
};

export const ENVIRONMENT_TYPE = {
  POPUP: 'popup',
  NOTIFICATION: 'notification',
  FULLSCREEN: 'fullscreen',
  BACKGROUND: 'background',
};

export type EnvironmentType =
  typeof ENVIRONMENT_TYPE[keyof typeof ENVIRONMENT_TYPE];

export const DEFAULT_STATE = {
  AccountTrackerState: { accounts: {} },
  KeyringControllerState: { wallets: [] },
  CurrencyControllerState: {
    conversionDate: Date.now().toString(),
    conversionRate: 0,
    currentCurrency: 'usd',
    nativeCurrency: 'eth',
    ticker: 'eth',
  },
  NetworkControllerState: {
    chainId: SUPPORTED_NETWORKS[CHAINS.LOCAL].chainId,
    properties: {},
    providerConfig: SUPPORTED_NETWORKS[CHAINS.LOCAL],
  },
  PreferencesControllerState: {
    identities: {},
    selectedAddress: '',
  },
};
