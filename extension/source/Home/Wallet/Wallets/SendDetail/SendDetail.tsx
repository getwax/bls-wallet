import { FunctionComponent, useMemo, useState } from 'react';
import forEach from '../../../../cells/forEach';
import MemoryCell from '../../../../cells/MemoryCell';
import useCell from '../../../../cells/useCell';
import assert from '../../../../helpers/assert';
import AsyncReturnType from '../../../../types/AsyncReturnType';
import { RpcClient } from '../../../../types/Rpc';
import { useQuill } from '../../../QuillContext';
import AmountSelector from './AmountSelector';

import AssetSelector from './AssetSelector';
import BigSendButton from './BigSendButton';
import RecipientSelector from './RecipientSelector';
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

const SendDetail: FunctionComponent = () => {
  const quill = useQuill();

  const cells = useMemo(
    () => ({
      selectedAsset: new MemoryCell<string | undefined>(undefined),
      recipient: new MemoryCell<string | undefined>(undefined),
      amountWei: new MemoryCell<string | undefined>(undefined),
    }),
    [],
  );

  const selectedAsset = useCell(cells.selectedAsset);
  const recipient = useCell(cells.recipient);
  const amountWei = useCell(cells.amountWei);

  const [sendState, setSendState] = useState<SendState>();

  return (
    <div className="flex flex-col gap-8">
      <BigSendButton
        selectedAsset={cells.selectedAsset}
        recipient={cells.recipient}
        amountWei={cells.amountWei}
      />
      {(() => {
        if (selectedAsset === undefined) {
          return <AssetSelector selectedAsset={cells.selectedAsset} />;
        }

        if (recipient === undefined) {
          return <RecipientSelector recipient={cells.recipient} />;
        }

        if (amountWei === undefined) {
          return (
            <AmountSelector
              selectedAsset={cells.selectedAsset}
              onSend={async (wei) => {
                cells.amountWei.write(wei);

                const from = await quill.cells.selectedAddress.read();
                assert(from !== undefined);

                assert(recipient !== undefined);

                try {
                  const sendBlock = await quill.cells.blockNumber.read();
                  setSendState({ step: 'sending', sendBlock });

                  let receipt: Receipt | undefined;

                  const txHash = await quill.rpc.eth_sendTransaction({
                    from,
                    to: recipient,
                    gas: undefined,
                    gasPrice: undefined,
                    value: wei,
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
                        receipt = await quill.rpc.eth_getTransactionReceipt(
                          txHash,
                        );

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
              }}
            />
          );
        }

        return sendState && <SendProgress state={sendState} />;
      })()}
    </div>
  );
};

export default SendDetail;
