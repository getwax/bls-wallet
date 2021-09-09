import { BlsWalletSigner } from 'bls-wallet-signer';
import type { ethers } from 'ethers';
import type AggregatorClient from '../AggregatorClient';

export default class App {
  constructor(
    public blsWalletSigner: BlsWalletSigner,
    public aggregatorClient: AggregatorClient,
    public provider: ethers.providers.Provider,
  ) {}
}
