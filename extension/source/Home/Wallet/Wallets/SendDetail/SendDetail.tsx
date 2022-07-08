import { FunctionComponent, useMemo, useState } from 'react';

import forEach from '../../../../cells/forEach';
import ICell from '../../../../cells/ICell';
import MemoryCell from '../../../../cells/MemoryCell';
import assert from '../../../../helpers/assert';
import AsyncReturnType from '../../../../types/AsyncReturnType';
import { RpcClient } from '../../../../types/Rpc';
import { QuillContextValue, useQuill } from '../../../QuillContext';

import BigSendButton from './BigSendButton';
import SendDetailSelectors from './SendDetailSelectors';
import SendProgress from './SendProgress';

type Receipt = Exclude<
  AsyncReturnType<RpcClient['eth_getTransactionReceipt']>,
  undefined
>;

export type SendState =
  | { step: 'sending'; sendBlock: number }
  | { step: 'awaiting-confirmation'; txHash: string; sendBlock: number }
  | {
      step: 'confirmed';
      sendBlock: number;
      receipt: Exclude<
        AsyncReturnType<RpcClient['eth_getTransactionReceipt']>,
        undefined
      >;
    }
  | { step: 'error'; message: string };

export type SendDetailCells = {
  selectedAsset: ICell<string | undefined>;
  recipient: ICell<string | undefined>;
  amountWei: ICell<string | undefined>;
};

const SendDetail: FunctionComponent = () => {
  const quill = useQuill();

  const cells: SendDetailCells = useMemo(
    () => ({
      selectedAsset: new MemoryCell(undefined),
      recipient: new MemoryCell(undefined),
      amountWei: new MemoryCell(undefined),
    }),
    [],
  );

  const [sendState, setSendState] = useState<SendState>();

  return (
    <div className="flex flex-col gap-8">
      <BigSendButton cells={cells} />
      <SendDetailSelectors
        cells={cells}
        onSend={async (amountWei) => {
          cells.amountWei.write(amountWei);

          const from = await quill.cells.selectedAddress.read();
          assert(from !== undefined);

          const recipient = await cells.recipient.read();
          assert(recipient !== undefined);

          await send(quill, setSendState, {
            from,
            to: recipient,
            value: amountWei,
          });
        }}
      />
      {sendState && <SendProgress state={sendState} />}
    </div>
  );
};

async function send(
  quill: QuillContextValue,
  setSendState: (state: SendState) => void,
  tx: {
    from: string;
    to: string;
    value: string;
  },
) {
  try {
    const sendBlock = await quill.cells.blockNumber.read();
    setSendState({ step: 'sending', sendBlock });

    let receipt: Receipt | undefined;

    const txHash = await quill.rpc.eth_sendTransaction({
      ...tx,
      gas: undefined,
      gasPrice: undefined,
      data: undefined,
    });

    setSendState({
      step: 'awaiting-confirmation',
      txHash,
      sendBlock,
    });

    const forEachHandle = forEach(
      quill.cells.blockNumber,
      async ($blockNumber) => {
        if ($blockNumber > sendBlock) {
          receipt = await quill.rpc.eth_getTransactionReceipt(txHash);

          if (receipt === undefined) {
            return;
          }

          forEachHandle.stop();
        }
      },
    );

    await forEachHandle.iterationCompletionPromise;
    assert(receipt !== undefined);

    setSendState({
      step: 'confirmed',
      sendBlock,
      receipt,
    });
  } catch (error) {
    assert(error instanceof Error);
    setSendState({ step: 'error', message: error.message });
  }
}

export default SendDetail;
