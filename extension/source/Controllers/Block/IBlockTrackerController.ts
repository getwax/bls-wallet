import { BaseConfig, BaseState } from '../interfaces';
import { SafeEventEmitterProvider } from '../Network/INetworkController';

export interface BaseBlockTrackerConfig extends BaseConfig {
  blockResetDuration?: number;
}

export interface PollingBlockTrackerConfig extends BaseBlockTrackerConfig {
  provider: SafeEventEmitterProvider;
  pollingInterval: number;
  retryTimeout: number;
  setSkipCacheFlag: boolean;
}

export interface BaseBlockTrackerState extends BaseState {
  /**
   * block number in hex string
   */
  _currentBlock?: string;
  _isRunning?: boolean;
}

export type PollingBlockTrackerState = BaseBlockTrackerState;
