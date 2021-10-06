import * as React from 'react';
import Button from '../components/Button';
import { PageEvents } from '../components/Page';
import getPropOrUndefined from '../helpers/getPropOrUndefined';
import QuillEthereumProvider from '../PageContentScript/QuillEthereumProvider';

type Props = { events: PageEvents };

const CreateTransaction: React.FC<Props> = (props: Props) => {
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
              <Button
                highlight={true}
                onPress={async () => {
                  const provider = getPropOrUndefined(window, 'ethereum') as
                    | QuillEthereumProvider
                    | undefined;

                  if (provider === undefined) {
                    props.events.emit(
                      'notification',
                      'error',
                      'Ethereum provider not found',
                    );

                    return;
                  }

                  try {
                    const result = await provider.request({
                      method: 'eth_sendTransaction',
                      params: [{}],
                    });

                    props.events.emit(
                      'notification',
                      'info',
                      `Result: ${result}`,
                    );
                  } catch (error) {
                    props.events.emit(
                      'notification',
                      'error',
                      (error as Error).message,
                    );
                  }
                }}
              >
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
