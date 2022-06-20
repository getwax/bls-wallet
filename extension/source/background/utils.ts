// TODO: Move to helpers

import { encode as encode58 } from 'bs58check';

export const RandomId = (): string =>
  encode58(crypto.getRandomValues(new Uint8Array(16)));
