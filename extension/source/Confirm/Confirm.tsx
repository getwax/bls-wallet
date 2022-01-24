import { ethers } from 'ethers';
import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import TaskQueue from '../common/TaskQueue';

// components, styles and UI
import Button from '../components/Button';
import CompactQuillHeading from '../components/CompactQuillHeading';
import { useInputDecode } from '../hooks/useInputDecode';
import formatCompactAddress from '../Popup/helpers/formatCompactAddress';

const Confirm: React.FunctionComponent = () => {
  const [id, setId] = useState<string>();
  const [to, setTo] = useState<string>('0x');
  const [value, setValue] = useState<string>('0');
  const [data, setData] = useState<string>('0x');

  const { loading, method } = useInputDecode(data, to);

  const cleanupTasks = React.useMemo(() => new TaskQueue(), []);

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    setId(params.get('id') || '0');
    setTo(params.get('to') || '0x');
    setValue(params.get('value') || '0');
    setData(params.get('data') || '0x');

    return cleanupTasks.run();
  }, [cleanupTasks]);

  const respondTx = (result: string) => {
    browser.runtime.sendMessage(undefined, { id, result });
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

            <Button className="btn-primary" onPress={() => respondTx('Yes')}>
              Confirm
            </Button>
            <Button className="btn-secondary" onPress={() => respondTx('No')}>
              Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Confirm;
