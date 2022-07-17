import { ethers } from 'ethers';
import * as io from 'io-ts';
import { FunctionComponent, useMemo } from 'react';

import assertType from '../../../cells/assertType';
import { FormulaCell } from '../../../cells/FormulaCell';
import { IReadableCell } from '../../../cells/ICell';
import useCell from '../../../cells/useCell';
import Loading from '../../../components/Loading';
import assert from '../../../helpers/assert';
import { useQuill } from '../../../QuillContext';

const Balance: FunctionComponent<{ address: string }> = ({ address }) => {
  const quill = useQuill();

  const balanceWeiHex: IReadableCell<string> = useMemo(
    () =>
      new FormulaCell({ blockNumber: quill.cells.blockNumber }, async () => {
        const response = await quill.ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest'],
        });

        assertType(response, io.string);
        assert(response.slice(0, 2) === '0x');

        return response;
      }),
    [address, quill],
  );

  const $balanceWeiHex = useCell(balanceWeiHex);

  if ($balanceWeiHex === undefined) {
    return <Loading />;
  }

  return <>{ethers.utils.formatEther($balanceWeiHex)} ETH</>;
};

export default Balance;
