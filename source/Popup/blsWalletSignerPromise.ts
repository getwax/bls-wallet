import { initBlsWalletSigner } from 'bls-wallet-signer';

import { CHAIN_ID } from '../env';

export default initBlsWalletSigner({ chainId: CHAIN_ID });
