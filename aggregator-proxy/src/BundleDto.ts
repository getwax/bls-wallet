import * as io from 'io-ts';

import { BundleDto } from 'bls-wallet-clients';

const BundleDto = io.type({
  signature: io.tuple([io.string, io.string]),
  senderPublicKeys: io.array(
    io.tuple([io.string, io.string, io.string, io.string])
  ),
  operations: io.array(io.type({
    nonce: io.string,
    gas: io.string,
    actions: io.array(io.type({
      ethValue: io.string,
      contractAddress: io.string,
      encodedFunction: io.string,
    })),
  })),
});

export default BundleDto;
