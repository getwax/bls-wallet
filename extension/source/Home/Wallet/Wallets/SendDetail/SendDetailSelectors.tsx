import { FunctionComponent } from 'react';
import useCell from '../../../../cells/useCell';
import AmountSelector from './AmountSelector';
import AssetSelector from './AssetSelector';
import RecipientSelector from './RecipientSelector';

import type { SendDetailCells } from './SendDetail';

const SendDetailSelectors: FunctionComponent<{
  cells: SendDetailCells;
  onSend: (amountWei: string) => void;
}> = ({ cells, onSend }) => {
  const selectedAsset = useCell(cells.selectedAsset);
  const recipient = useCell(cells.recipient);
  const amountWei = useCell(cells.amountWei);

  if (selectedAsset === undefined) {
    return <AssetSelector selectedAsset={cells.selectedAsset} />;
  }

  if (recipient === undefined) {
    return <RecipientSelector recipient={cells.recipient} />;
  }

  if (amountWei === undefined) {
    return (
      <AmountSelector selectedAsset={cells.selectedAsset} onSend={onSend} />
    );
  }

  return <></>;
};

export default SendDetailSelectors;
