import { BlsWalletWrapper } from 'bls-wallet-clients';
import { FunctionComponent, useMemo } from 'react';

import { FormulaCell } from '../../../cells/FormulaCell';
import useCell from '../../../cells/useCell';
import { useQuill } from '../../../QuillContext';

const DisplayNonce: FunctionComponent<{ address: string }> = ({ address }) => {
  const quill = useQuill();

  const nonce = useMemo(
    () =>
      new FormulaCell(
        { blockNumber: quill.cells.blockNumber, network: quill.cells.network },
        async ({ $network }) => {
          const netCfg = quill.multiNetworkConfig[$network.networkKey];

          if (netCfg === undefined) {
            return `Missing network config for ${$network.displayName}`;
          }

          const wallet = await BlsWalletWrapper.connect(
            await quill.rpc.lookupPrivateKey(address),
            netCfg.addresses.verificationGateway,
            await quill.ethersProvider.read(),
          );

          return (await wallet.Nonce()).toNumber();
        },
      ),
    [quill, address],
  );

  const nonceValue = useCell(nonce);

  return <>{nonceValue}</>;
};

export default DisplayNonce;
