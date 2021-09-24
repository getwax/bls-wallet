import * as React from 'react';
import Button from '../components/Button';

import './styles.scss';

const CreateTransaction: React.FC = () => {
  return (
    <div className="create-transaction">
      <div className="section">
        <h1>Create Transaction</h1>
      </div>
      <div className="section body">
        <div className="form">
          <div>
            Amount: <input type="text" style={{ textAlign: 'end' }} /> ETH
          </div>
          <div>
            Recipient: <input type="text" />
          </div>
          <div>
            <div style={{ display: 'inline-block' }}>
              <Button highlight={true} onPress={() => {}}>
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTransaction;
