import { FunctionComponent, useState } from 'react';
import { runtime } from 'webextension-polyfill';

// components, styles and UI
import { Check, X, CaretLeft, CaretRight } from 'phosphor-react';
import { ethers } from 'ethers';
import Button from '../components/Button';
import {
  PromptMessage,
  SendTransactionParams,
  TransactionStatus,
} from '../types/Rpc';
import TransactionCard from './TransactionCard';
import onAction from '../helpers/onAction';
import { useQuill } from '../QuillContext';
import useCell from '../cells/useCell';
import Loading from '../components/Loading';
import CurrencyDisplay from '../components/CurrencyDisplay';

const Confirm: FunctionComponent = () => {
  const quill = useQuill();

  const id = new URL(window.location.href).searchParams.get('id');
  const transactions = useCell(quill.cells.transactions);

  const [current, setCurrent] = useState<number>(0);

  if (transactions === undefined) {
    return <Loading />;
  }

  const tx = transactions.outgoing.find((t) => t.id === id);

  if (tx === undefined) {
    return <>Error: Tx not found</>;
  }

  const respondTx = (result: PromptMessage['result']) => {
    runtime.sendMessage(undefined, { id, result });
  };

  const nextTx = () => {
    setCurrent((current + 1) % tx.actions.length);
  };
  const prevTx = () => {
    setCurrent((current - 1) % tx.actions.length);
  };

  const calculateTotal = (allActions: SendTransactionParams[]) => {
    const total = allActions.reduce(
      (acc, cur) => acc.add(ethers.BigNumber.from(cur.value)),
      ethers.BigNumber.from(0),
    );
    return ethers.utils.formatEther(total);
  };

  return (
    <div className="flex flex-col justify-between h-screen bg-grey-200">
      <div className="p-4 flex justify-between text-white bg-blue-700">
        Transaction request
      </div>
      <div className="flex-grow p-4">
        <div className="">
          {/* site info */}
          <div className="flex gap-4">
            <div className="h-10 w-10 bg-grey-400 rounded-full" />
            <div className="leading-5">
              <div className="">AppName</div>
              <div className="text-blue-400">https://app-url.com/</div>
            </div>
          </div>
        </div>

        <div className="mt-4">AppName is making requests to your wallet</div>

        {tx.actions.length > 1 && (
          <div className="mt-4 flex justify-end text-body self-center gap-3">
            {current + 1} of {tx.actions?.length}
            <div
              className={[
                'bg-grey-400',
                'rounded-md',
                'p-1',
                'hover:bg-grey-500',
                'cursor-pointer',
              ].join(' ')}
              {...onAction(prevTx)}
            >
              <CaretLeft size={20} className="self-center" />
            </div>
            <div
              className={[
                'bg-grey-400',
                'rounded-md',
                'p-1',
                'hover:bg-grey-500',
                'cursor-pointer',
              ].join(' ')}
              {...onAction(nextTx)}
            >
              <CaretRight size={20} className="self-center" />
            </div>
          </div>
        )}

        <div className="flex flex-col">
          <div className="mt-4">
            {tx.actions[current] && (
              <TransactionCard {...tx.actions[current]} />
            )}
          </div>

          <div
            className={[
              'mt-4',
              'p-4',
              'bg-grey-300',
              'rounded-md',
              'flex',
              'justify-between',
              'h-20',
            ].join(' ')}
          >
            <div className="">
              <div>Fees</div>
              <div>Total</div>
            </div>
            <div className="text-right">
              <div className="font-bold">
                <CurrencyDisplay chainValue={0} />
              </div>
              <div className="">{calculateTotal(tx.actions)} ETH</div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex bg-white p-4 justify-between">
        <Button
          className="btn-secondary"
          onPress={() => respondTx(TransactionStatus.REJECTED)}
        >
          <div className="flex justify-between gap-3">
            Reject All <X size={20} className="self-center" />
          </div>
        </Button>

        <Button
          className="btn-primary"
          onPress={() => respondTx(TransactionStatus.APPROVED)}
        >
          <div className="flex justify-between gap-3">
            Confirm All <Check size={20} className="self-center" />
          </div>
        </Button>
      </div>
    </div>
  );
};

export default Confirm;
