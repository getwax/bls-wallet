import { ethers } from 'ethers';
import { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { runtime } from 'webextension-polyfill';
import TaskQueue from '../helpers/TaskQueue';

// components, styles and UI
import Button from '../components/Button';
import CompactQuillHeading from '../components/CompactQuillHeading';
import { DEFAULT_CHAIN_ID_HEX } from '../env';
import { useInputDecode } from '../hooks/useInputDecode';
import formatCompactAddress from '../helpers/formatCompactAddress';
import { TransactionStatus } from '../background/TransactionsController';
import { useQuill } from '../Home/QuillContext';
import useCell from '../cells/useCell';

const Confirm: FunctionComponent = () => {
  const [id, setId] = useState<string>();
  const quill = useQuill();

  const data = '0x';
  const to = '0x';
  const value = '0x';

  const { loading, method } = useInputDecode(data, to, '0xa');

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    setId(params.get('id') || '0');

    // const allTransactions = useCell(quill.cells.transactions);
    // const transaction = allTransactions?.outgoing.find((t) => t.id === id);
    // console.log(transaction);
  }, []);

  const respondTx = (result: string) => {
    runtime.sendMessage(undefined, { id, result });
  };

  return (
    <div className="confirm">
      <div className="section">
        <CompactQuillHeading />
      </div>
      <div className="section prompt">
        {loading ? (
          'loading...'
        ) : (
          <>
            <div>{method}</div>
            <div>to: {formatCompactAddress(to)}</div>
            <div>value: {ethers.utils.formatEther(value)} ETH</div>
            <div>
              data:
              <div className="data">{data}</div>
            </div>

            <Button
              className="btn-primary"
              onPress={() => respondTx(TransactionStatus.APPROVED)}
            >
              Confirm
            </Button>
            <Button
              className="btn-secondary"
              onPress={() => respondTx(TransactionStatus.REJECTED)}
            >
              Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Confirm;
