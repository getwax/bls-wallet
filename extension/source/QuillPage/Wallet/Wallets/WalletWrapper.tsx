import { FunctionComponent, useEffect, useState } from 'react';
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
  const keyring = useCell(quill.keyring);

  const [selected, setSelected] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const accounts = await rpc.public.eth_accounts();

      if (accounts[0]) {
        rpc.private.quill_setSelectedAddress(accounts[0]);
      }
    })();
  }, [rpc]);

  return (
    <div className="">
      <div className="flex justify-between place-items-center">
        <div className="text-body">Wallets</div>
        <Button
          onPress={async () => {
            await rpc.private.quill_createHDAccount();
            // window.location.reload();
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
                setSelected(index);
                rpc.private.quill_setSelectedAddress(wallet.address);
              }}
              key={wallet.address}
              wallet={{
                address: wallet.address,
                name: `wallet ${index}`,
                ether: 0,
                networks: 1,
                tokens: 0,
              }}
              expanded={index === selected}
            />
          ))}
        </div>
      )}
    </div>
  );
};
