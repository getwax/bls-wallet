import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import TaskQueue from '../common/TaskQueue';

// hooks and services

// components, styles and UI
import Button from '../components/Button';
import CompactQuillHeading from '../components/CompactQuillHeading';
import { useInputDecode } from '../hooks/useInputDecode';

// interfaces
export interface ConfirmProps {}

const Confirm: React.FunctionComponent<ConfirmProps> = () => {
  const [id, setId] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const [data, setData] = useState<string>('');

  const { loading, method } = useInputDecode(data);

  const cleanupTasks = new TaskQueue();

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    setId(params.get('id'));
    setTo(params.get('to'));
    setValue(params.get('value'));
    setData(params.get('data') || '0x');

    return cleanupTasks.run();
  }, []);

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
            <div>to: {to}</div>
            <div>value: {value}</div>
            <div>
              data:
              <div className="data">{data}</div>
            </div>

            <Button highlight onPress={() => respondTx('Yes')}>
              Confirm
            </Button>
            <Button onPress={() => respondTx('No')}>Reject</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Confirm;
