export const CHAINS = {
  MAINNET: 'mainnet',
  RINKEBY: 'rinkeby',
  KOVAN: 'kovan',
  ROPSTEN: 'ropsten',
  GOERLI: 'goerli',
} as const;

export type ChainType = typeof CHAINS[keyof typeof CHAINS];

export interface ProviderConfig {
  /**
   * Block explorer url for the chain
   * @example https://ropsten.etherscan.io
   */
  blockExplorerUrl: string;
  /**
   * Logo url for the base token
   */
  logo: string;
  /**
   * Name for ticker
   * @example 'Binance Token', 'Ethereum', 'Matic Network Token'
   */
  tickerName: string;
  /**
   * Symbol for ticker
   * @example BNB, ETH
   */
  ticker: string;
  /**
   * RPC target Url for the chain
   * @example https://ropsten.infura.io/v3/YOUR_API_KEY
   */
  rpcTarget: string;
  /**
   * Chain Id parameter(hex with 0x prefix) for the network. Mandatory for all networks. (assign one with a map to network identifier for platforms)
   * @example 0x1 for mainnet, 'loading' if not connected to anything yet or connection fails
   * @defaultValue 'loading'
   */
  chainId: string;
  /**
   * Display name for the network
   */
  displayName: string;

  /**
   * Unique key for network (used for infura)
   */
  networkKey: ChainType;
}

export const CHAIN_ID_NETWORK_MAP = {
  '0x1': CHAINS.MAINNET,
  '0x4': CHAINS.RINKEBY,
  '0X2a': CHAINS.KOVAN,
  '0x3': CHAINS.ROPSTEN,
  '0x5': CHAINS.GOERLI,
} as const;

export const SUPPORTED_NETWORKS = {
  [CHAINS.MAINNET]: {
    blockExplorerUrl: 'https://etherscan.io',
    chainId: '0x1',
    displayName: 'Main Ethereum Network',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Ethereum-icon-purple.svg',
    rpcTarget: CHAINS.MAINNET,
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: CHAINS.MAINNET,
  } as ProviderConfig,
  [CHAINS.RINKEBY]: {
    blockExplorerUrl: 'https://rinkeby.etherscan.io',
    chainId: '0x4',
    displayName: 'Rinkeby Test Network',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Ethereum-icon-purple.svg',
    rpcTarget: CHAINS.RINKEBY,
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: CHAINS.RINKEBY,
  } as ProviderConfig,
  [CHAINS.KOVAN]: {
    blockExplorerUrl: 'https://kovan.etherscan.io',
    chainId: '0x4',
    displayName: 'Kovan Test Network',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Ethereum-icon-purple.svg',
    rpcTarget: CHAINS.KOVAN,
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: CHAINS.KOVAN,
  } as ProviderConfig,
  [CHAINS.ROPSTEN]: {
    blockExplorerUrl: 'https://ropsten.etherscan.io',
    chainId: '0x3',
    displayName: 'Ropsten Test Network',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Ethereum-icon-purple.svg',
    rpcTarget: CHAINS.ROPSTEN,
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: CHAINS.ROPSTEN,
  } as ProviderConfig,
  [CHAINS.GOERLI]: {
    blockExplorerUrl: 'https://goerli.etherscan.io',
    chainId: '0x5',
    displayName: 'Goerli Test Network',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Ethereum-icon-purple.svg',
    rpcTarget: CHAINS.GOERLI,
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: CHAINS.GOERLI,
  } as ProviderConfig,
} as const;
