import { BlsWalletWrapper } from 'bls-wallet-clients';
import { FunctionComponent, useMemo } from 'react';
import { FormulaCell } from '../../../cells/FormulaCell';
import useCell from '../../../cells/useCell';
import { NETWORK_CONFIG } from '../../../env';
import { useQuill } from '../../../QuillContext';

const DisplayNonce: FunctionComponent<{ address: string }> = ({ address }) => {
  const quill = useQuill();

  const nonce = useMemo(() => {
    return new FormulaCell(
      { blockNumber: quill.cells.blockNumber },
      async () => {
        const wallet = await BlsWalletWrapper.connect(
          await quill.rpc.lookupPrivateKey(address),
          NETWORK_CONFIG.addresses.verificationGateway,
          quill.ethersProvider,
        );

        return (await wallet.Nonce()).toNumber();
      },
    );
  }, [quill.cells.blockNumber, quill.ethersProvider, quill.rpc, address]);

  const nonceValue = useCell(nonce);

  return <>{nonceValue}</>;
};

export default DisplayNonce;
