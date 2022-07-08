import { CaretLeft, X } from 'phosphor-react';
import { FunctionComponent } from 'react';
import { useNavigate } from 'react-router-dom';

import useCell from '../../../../cells/useCell';
import formatCompactAddress from '../../../../helpers/formatCompactAddress';
import onAction from '../../../../helpers/onAction';
import type { SendDetailCells } from './SendDetail';

const roundFieldClasses = [
  'text-[8pt] bg-blue-100 bg-opacity-40 leading-normal',
  'rounded-full px-2 py-1 flex place-items-center gap-2',
].join(' ');

const BigSendButton: FunctionComponent<{
  sendDetailCells: SendDetailCells;
}> = ({ sendDetailCells }) => {
  const navigate = useNavigate();

  const selectedAsset = useCell(sendDetailCells.selectedAsset);
  const recipient = useCell(sendDetailCells.recipient);
  const amountWei = useCell(sendDetailCells.amountWei);

  const visibility = amountWei === undefined ? '' : 'invisible';

  return (
    <div className="btn-primary-outer justify-center grow leading-10">
      <div className="flex grow justify-center">
        <div
          className={`${visibility} btn-primary-inner flex flex-row gap-2`}
          {...onAction(async () => {
            if (recipient !== undefined) {
              await sendDetailCells.recipient.write(undefined);
            } else if (selectedAsset !== undefined) {
              await sendDetailCells.selectedAsset.write(undefined);
            } else {
              navigate('/wallets');
            }
          })}
        >
          <CaretLeft className="self-center" size={20} />
          <div>Back</div>
        </div>
        <div className="flex grow justify-center py-2 gap-2">
          <div>Send</div>
          {selectedAsset !== undefined && (
            <div className="flex flex-col justify-center">
              <div className={roundFieldClasses}>{selectedAsset}</div>
            </div>
          )}
          {recipient !== undefined && (
            <>
              <div>to</div>
              <div className="flex flex-col justify-center">
                <div className={roundFieldClasses}>
                  {formatCompactAddress(recipient)}
                </div>
              </div>
            </>
          )}
        </div>
        <div
          className={`${visibility} btn-primary-inner flex flex-row gap-2`}
          {...onAction(() => navigate('/wallets'))}
        >
          <div>Cancel</div>
          <X className="self-center" size={20} />
        </div>
      </div>
    </div>
  );
};

export default BigSendButton;
