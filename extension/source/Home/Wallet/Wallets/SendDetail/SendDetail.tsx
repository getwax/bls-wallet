import { FunctionComponent, useMemo } from 'react';
import MemoryCell from '../../../../cells/MemoryCell';
import useCell from '../../../../cells/useCell';

import AssetSelector from './AssetSelector';
import BigSendButton from './BigSendButton';
import RecipientSelector from './RecipientSelector';

const SendDetail: FunctionComponent = () => {
  const cells = useMemo(
    () => ({
      selectedAsset: new MemoryCell<string | undefined>(undefined),
      recipient: new MemoryCell<string | undefined>(undefined),
    }),
    [],
  );

  const $selectedAsset = useCell(cells.selectedAsset);

  return (
    <div className="flex flex-col gap-8">
      <BigSendButton
        selectedAsset={cells.selectedAsset}
        recipient={cells.recipient}
      />
      {$selectedAsset === undefined && (
        <AssetSelector selectedAsset={cells.selectedAsset} />
      )}
      {$selectedAsset !== undefined && (
        <RecipientSelector recipient={cells.recipient} />
      )}
    </div>
  );
};

export default SendDetail;
