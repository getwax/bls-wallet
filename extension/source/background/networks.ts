import * as io from 'io-ts';
import assert from '../helpers/assert';
import ensureType from '../helpers/ensureType';
import ExplicitAny from '../types/ExplicitAny';

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
   * @example 'Binance Token', 'Ether', 'Matic Network Token'
   */
  chainCurrencyName: io.string,
  /**
   * @example BNB, ETH
   */
  chainCurrency: io.string,
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

// FIXME: This belongs in config.
export const builtinProviderConfigs = ensureType<
  Record<string, ProviderConfig>
>()({
  'arbitrum-rinkeby': {
    blockExplorerUrl: 'https://rinkeby-explorer.arbitrum.io',
    chainId: '0x66eeb', // 421611
    displayName: 'Arbitrum Test Network',
    logo: '',
    rpcTarget: 'https://rinkeby.arbitrum.io/rpc',
    chainCurrencyName: 'Arbitrum Ether',
    chainCurrency: 'ARETH',
    networkKey: 'arbitrum-rinkeby',
  },
  arbitrum: {
    blockExplorerUrl: 'https://explorer.arbitrum.io',
    chainId: '0xa4b1', // 42161
    displayName: 'Arbitrum One',
    logo: '',
    rpcTarget: `https://arb1.arbitrum.io/rpc`,
    chainCurrencyName: 'Ether',
    chainCurrency: 'ETH',
    networkKey: 'arbitrum',
  },
  'optimism-kovan': {
    blockExplorerUrl: 'https://kovan-optimistic.etherscan.io',
    chainId: '0x45', // 69
    displayName: 'Optimism Test Network',
    logo: '',
    rpcTarget: 'https://kovan.optimism.io',
    chainCurrencyName: 'Optimistic Kovan Ether',
    chainCurrency: 'KOR',
    networkKey: 'optimism-kovan',
  },
  optimism: {
    blockExplorerUrl: 'https://optimistic.etherscan.io',
    chainId: '0xa', // 10
    displayName: 'Optimism',
    logo: '',
    rpcTarget: 'https://mainnet.optimism.io',
    chainCurrencyName: 'Ether',
    chainCurrency: 'ETH',
    networkKey: 'optimism',
  },
  local: {
    blockExplorerUrl: 'N/A',
    chainId: '0x7a69', // 31337
    displayName: 'Local Network',
    logo: '',
    rpcTarget: 'http://localhost:8545',
    chainCurrencyName: 'Ethereum',
    chainCurrency: 'ETH',
    networkKey: 'local',
  },
} as const);

type BuiltinProviderConfigs = typeof builtinProviderConfigs;

export type BuiltinChainName = keyof BuiltinProviderConfigs;

export type BuiltinChainId =
  BuiltinProviderConfigs[BuiltinChainName]['chainId'];

export const BuiltinChainId: io.Type<BuiltinChainId> = io.union(
  Object.values(builtinProviderConfigs).map((c) =>
    io.literal(c.chainId),
  ) as ExplicitAny,
);

export function builtinChainIdToName(id: BuiltinChainId): BuiltinChainName {
  const config = Object.values(builtinProviderConfigs).find(
    (c) => c.chainId === id,
  );

  assert(config !== undefined);
  return config.networkKey;
}
