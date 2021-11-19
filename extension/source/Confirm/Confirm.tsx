import React, { useEffect, useState } from 'react';
import { browser } from 'webextension-polyfill-ts';
import TaskQueue from '../common/TaskQueue';

// hooks and services

// components, styles and UI
import Button from '../components/Button';
import CompactQuillHeading from '../components/CompactQuillHeading';

// interfaces
export interface ConfirmProps {}

const Confirm: React.FunctionComponent<ConfirmProps> = () => {
  const [id, setId] = useState<string | null>();
  const [prompt, setPromt] = useState<string>();

  const cleanupTasks = new TaskQueue();

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    setId(params.get('id'));
    setPromt(params.get('promptText') || '(promptText not set)');

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
        <div>{prompt}</div>
        <div />
        <Button highlight onPress={() => respondTx('Yes')}>
          Confirm
        </Button>
        <Button onPress={() => respondTx('No')}>Reject</Button>
      </div>
    </div>
  );
};

export default Confirm;
