import { FunctionComponent, useMemo } from 'react';
import MemoryCell from '../../../../cells/MemoryCell';
import useCell from '../../../../cells/useCell';
import AmountSelector from './AmountSelector';

import AssetSelector from './AssetSelector';
import BigSendButton from './BigSendButton';
import RecipientSelector from './RecipientSelector';

const SendDetail: FunctionComponent = () => {
  const cells = useMemo(
    () => ({
      selectedAsset: new MemoryCell<string | undefined>(undefined),
      recipient: new MemoryCell<string | undefined>(undefined),
      amountWei: new MemoryCell<string | undefined>(undefined),
    }),
    [],
  );

  const $selectedAsset = useCell(cells.selectedAsset);
  const $recipient = useCell(cells.recipient);
  const $amountWei = useCell(cells.amountWei);

  return (
    <div className="flex flex-col gap-8">
      <BigSendButton
        selectedAsset={cells.selectedAsset}
        recipient={cells.recipient}
        amountWei={cells.amountWei}
      />
      {(() => {
        if ($selectedAsset === undefined) {
          return <AssetSelector selectedAsset={cells.selectedAsset} />;
        }

        if ($recipient === undefined) {
          return <RecipientSelector recipient={cells.recipient} />;
        }

        if ($amountWei === undefined) {
          return (
            <AmountSelector
              selectedAsset={cells.selectedAsset}
              onSend={(wei) => cells.amountWei.write(wei)}
            />
          );
        }

        return (
          <>
            TODO: Send {$amountWei} {$selectedAsset} to {$recipient}
          </>
        );
      })()}
    </div>
  );
};

export default SendDetail;
