import { ethers } from 'ethers';
import { FunctionComponent, useMemo } from 'react';
import { FormulaCell } from '../../cells/FormulaCell';
import MemoryCell from '../../cells/MemoryCell';
import QuillContext from '../QuillContext';
import { Display } from './Display';
import TextBox from './TextBox';

const BalanceWidget: FunctionComponent = () => {
  const quillCtx = QuillContext.use();

  const cells = useMemo(() => {
    const address = new MemoryCell('');

    const balanceDisplay = new FormulaCell(
      { address, _: quillCtx.blockNumber },
      // eslint-disable-next-line @typescript-eslint/no-shadow
      async ({ address }) => {
        const addressError = (() => {
          if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
            return new Error('Invalid address');
          }

          try {
            // Handles mixed case checksums
            ethers.utils.getAddress(address);
            return undefined;
          } catch (err) {
            const error = err as Error;

            if (error.message.includes('bad address checksum')) {
              return new Error('bad address checksum');
            }

            return error;
          }
        })();

        if (addressError) {
          return `(${addressError.message})`;
        }

        const balance = await quillCtx.ethersProvider.getBalance(address);
        return `ETH: ${(+ethers.utils.formatEther(balance)).toFixed(3)}`;
      },
    );

    return { address, balanceDisplay };
  }, [quillCtx]);

  return (
    <>
      <tr>
        <td>Address:</td>
        <td>
          <TextBox value={cells.address} />
        </td>
      </tr>
      <tr>
        <td>Balance:</td>
        <td>
          <Display cell={cells.balanceDisplay} />
        </td>
      </tr>
    </>
  );
};

export default BalanceWidget;
