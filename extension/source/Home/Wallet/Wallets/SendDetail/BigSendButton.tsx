import { CaretLeft, X } from 'phosphor-react';
import { FunctionComponent } from 'react';
import { useNavigate } from 'react-router-dom';

import onAction from '../../../../helpers/onAction';

const BigSendButton: FunctionComponent = () => {
  const navigate = useNavigate();

  return (
    <div className="btn-primary-outer justify-center grow leading-10">
      <div className="flex grow justify-center">
        <div
          className="btn-primary-inner flex flex-row gap-2"
          {...onAction(() => navigate('/wallets'))}
        >
          <CaretLeft className="self-center" size={20} />
          <div>Back</div>
        </div>
        <div className="flex grow justify-center py-2">Send</div>
        <div
          className="btn-primary-inner flex flex-row gap-2"
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
