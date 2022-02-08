import { ethers } from 'ethers';
import { Component, ReactElement } from 'react';
import Button from '../components/Button';
import { PageEvents } from '../components/Page';
import getPropOrUndefined from '../helpers/getPropOrUndefined';
import type QuillEthereumProvider from '../PageContentScript/InPageProvider';

type Props = { events: PageEvents };

export default class CreateTransaction extends Component<Props> {
  amountRef?: HTMLInputElement;
  recipientRef?: HTMLInputElement;
  dataRef?: HTMLInputElement;

  render(): ReactElement {
    return (
      <div className="create-transaction">
        <div className="section">
          <h1>Create Transaction</h1>
        </div>
        <div className="section body">
          <div className="form">
            <div>
              Amount:{' '}
              <input
                ref={(r) => (this.amountRef = r ?? undefined)}
                type="text"
                style={{ textAlign: 'end' }}
              />{' '}
              ETH
            </div>
            <div>
              Contract/Recipient:{' '}
              <input
                ref={(r) => (this.recipientRef = r ?? undefined)}
                type="text"
              />
            </div>
            <div>
              Encoded Function Data:{' '}
              <input
                ref={(r) => (this.dataRef = r ?? undefined)}
                type="text"
                defaultValue="0x"
              />
            </div>
            <div>
              <div style={{ display: 'inline-block' }}>
                <Button
                  className="btn-primary"
                  onPress={async () => {
                    const provider = getPropOrUndefined(window, 'ethereum') as
                      | QuillEthereumProvider
                      | undefined;

                    if (provider === undefined) {
                      this.props.events.emit(
                        'notification',
                        'error',
                        'Ethereum provider not found',
                      );

                      return;
                    }

                    try {
                      const amount = this.amountRef?.value || undefined;
                      const to = this.recipientRef?.value || undefined;
                      const data = this.dataRef?.value || undefined;

                      if (amount === undefined || to === undefined) {
                        this.props.events.emit(
                          'notification',
                          'error',
                          'Field(s) missing',
                        );

                        return;
                      }

                      const result = await provider.request({
                        method: 'eth_sendTransaction',
                        params: [
                          {
                            value: ethers.utils
                              .parseEther(amount)
                              .toHexString(),
                            to,
                            data,
                          },
                        ],
                      });

                      this.props.events.emit(
                        'notification',
                        'info',
                        `Result: ${result}`,
                      );
                    } catch (error) {
                      this.props.events.emit(
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
  }
}
