import React from 'react';
import { SendTransactionParams } from '../types/Rpc';
import Blockies from 'react-blockies';
import formatCompactAddress from '../helpers/formatCompactAddress';
import { ArrowRight } from 'phosphor-react';
import { useInputDecode } from '../hooks/useInputDecode';

const TransactionCard: React.FC<SendTransactionParams> = ({
  data,
  from,
  to,
  value,
  gas,
  gasPrice,
}) => {
  const { loading, method } = useInputDecode(data || '0x', to);

  return (
    <div className="bg-white rounded-md p-4 border">
      <div className="flex gap-4 w-full justify-between">
        <Blockies seed={from} className="rounded-md" size={5} scale={8} />
        <div className="flex justify-between flex-grow align-middle">
          <div className="leading-snug">
            <div>from</div>
            <div className="font-bold">{formatCompactAddress(from)}</div>
          </div>
          <ArrowRight size={20} alignmentBaseline={'central'} />
          <div className="leading-snug">
            <div>to</div>
            <div className="font-bold">{formatCompactAddress(to)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="break-all">
          details:{' '}
          <span className="font-bold">{loading ? 'loading...' : method}</span>
          <div className="text-[9pt] font-normal">{data}</div>
        </div>
      </div>

      <div className="flex mt-6">
        <div className="w-60">
          <div>ETH Value</div>
          <div className="break-all font-bold">{value || '0x0'}</div>
        </div>

        <div className="w-60">
          <div>Gas</div>
          <div className="break-all font-bold">{gas || '0x0'}</div>
        </div>

        <div className="w-60">
          <div>Gas Price</div>
          <div className="break-all font-bold">{gasPrice || '0x0'}</div>
        </div>
      </div>
    </div>
  );
};

export default TransactionCard;
