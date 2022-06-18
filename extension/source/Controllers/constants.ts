import * as io from 'io-ts';
import assert from '../helpers/assert';
import ExplicitAny from '../types/ExplicitAny';

export const chains = [
  {
    name: 'arbitrum-rinkeby',
    id: '0x66eeb',
  },
  {
    name: 'arbitrum',
    id: '0xa4b1',
  },
  {
    name: 'optimism-kovan',
    id: '0x45',
  },
  {
    name: 'optimism',
    id: '0xa',
  },
  {
    name: 'local',
    id: '0x7a69',
  },
] as const;

export type ChainName = typeof chains[number]['name'];
export type ChainId = typeof chains[number]['id'];

export const ChainId: io.Type<ChainId> = io.union(
  chains.map((c) => io.literal(c.id)) as ExplicitAny,
);

export function chainNameToId(name: ChainName): ChainId {
  const pair = chains.find((c) => c.name === name);
  assert(pair !== undefined);
  return pair.id;
}

export function chainIdToName(id: ChainId): ChainName {
  const pair = chains.find((c) => c.id === id);
  assert(pair !== undefined);
  return pair.name;
}

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

type SupportedProviderConfig = ProviderConfig & {
  chainId: ChainId;
  networkKey: ChainName;
};

export const SUPPORTED_NETWORKS: Record<ChainName, SupportedProviderConfig> = {
  'arbitrum-rinkeby': {
    blockExplorerUrl: 'https://rinkeby-explorer.arbitrum.io',
    chainId: chainNameToId('arbitrum-rinkeby'),
    displayName: 'Arbitrum Test Network',
    logo: '',
    rpcTarget: 'https://rinkeby.arbitrum.io/rpc',
    ticker: 'ARETH',
    tickerName: 'Arbitrum Ethereum',
    networkKey: 'arbitrum-rinkeby',
  },
  arbitrum: {
    blockExplorerUrl: 'https://explorer.arbitrum.io',
    chainId: chainNameToId('arbitrum'),
    displayName: 'Arbitrum One',
    logo: '',
    rpcTarget: `https://arb1.arbitrum.io/rpc`,
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: 'arbitrum',
  },
  'optimism-kovan': {
    blockExplorerUrl: 'https://kovan-optimistic.etherscan.io',
    chainId: chainNameToId('optimism-kovan'),
    displayName: 'Optimism Test Network',
    logo: '',
    rpcTarget: 'https://kovan.optimism.io',
    ticker: 'KOR',
    tickerName: '?',
    networkKey: 'optimism-kovan',
  },
  optimism: {
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    chainId: chainNameToId('optimism'),
    displayName: 'Optimism',
    logo: '',
    rpcTarget: 'https://mainnet.optimism.io',
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: 'optimism',
  },
  local: {
    blockExplorerUrl: 'N/A',
    chainId: chainNameToId('local'),
    displayName: 'Local Network',
    logo: '',
    rpcTarget: 'http://localhost:8545',
    ticker: 'ETH',
    tickerName: 'Ethereum',
    networkKey: 'local',
  },
};
