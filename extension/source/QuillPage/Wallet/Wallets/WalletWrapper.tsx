import { FunctionComponent } from 'react';
import useCell from '../../../cells/useCell';
import Button from '../../../components/Button';
import { useQuill } from '../../QuillContext';
import { WalletSummary } from './WalletSummary';

export interface IWallet {
  address: string;
  name: string;
  ether: number;
  networks: number;
  tokens: number;
}

export const WalletsWrapper: FunctionComponent = () => {
  const quill = useQuill();
  const { rpc } = quill;
  const keyring = useCell(quill.cells.keyring);
  const selectedAddress = useCell(quill.selectedAddress);

  return (
    <div className="">
      <div className="flex justify-between place-items-center">
        <div className="text-body">Wallets</div>
        <Button
          onPress={async () => {
            await rpc.private.createHDAccount();
          }}
          className="btn-secondary"
        >
          Add Wallet
        </Button>
      </div>

      {!keyring && 'Loading'}
      {keyring && (
        <div className="flex flex-col gap-6 mt-8">
          {keyring.wallets.map((wallet, index) => (
            <WalletSummary
              onClick={() => {
                rpc.private.setSelectedAddress(wallet.address);
              }}
              key={wallet.address}
              wallet={{
                address: wallet.address,
                name: `wallet ${index}`,
                ether: 0,
                networks: 1,
                tokens: 0,
              }}
              expanded={wallet.address === selectedAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
};
