import { CaretLeft, X } from 'phosphor-react';
import { FunctionComponent } from 'react';
import { useNavigate } from 'react-router-dom';

import ICell from '../../../../cells/ICell';
import useCell from '../../../../cells/useCell';
import formatCompactAddress from '../../../../helpers/formatCompactAddress';
import onAction from '../../../../helpers/onAction';

const roundFieldClasses = [
  'text-[8pt] bg-blue-100 bg-opacity-40 leading-normal',
  'rounded-full px-2 py-1 flex place-items-center gap-2',
].join(' ');

const BigSendButton: FunctionComponent<{
  selectedAsset: ICell<string | undefined>;
  recipient: ICell<string | undefined>;
  amountWei: ICell<string | undefined>;
}> = ({ selectedAsset, recipient, amountWei }) => {
  const navigate = useNavigate();

  const selectedAssetValue = useCell(selectedAsset);
  const recipientValue = useCell(recipient);
  const amountWeiValue = useCell(amountWei);

  const visibility = amountWeiValue === undefined ? '' : 'invisible';

  return (
    <div className="btn-primary-outer justify-center grow leading-10">
      <div className="flex grow justify-center">
        <div
          className={`${visibility} btn-primary-inner flex flex-row gap-2`}
          {...onAction(async () => {
            if (recipientValue !== undefined) {
              await recipient.write(undefined);
            } else if (selectedAssetValue !== undefined) {
              await selectedAsset.write(undefined);
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
          {selectedAssetValue !== undefined && (
            <div className="flex flex-col justify-center">
              <div className={roundFieldClasses}>{selectedAssetValue}</div>
            </div>
          )}
          {recipientValue !== undefined && (
            <>
              <div>to</div>
              <div className="flex flex-col justify-center">
                <div className={roundFieldClasses}>
                  {formatCompactAddress(recipientValue)}
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
