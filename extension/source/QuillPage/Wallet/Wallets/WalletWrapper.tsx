import { FunctionComponent, useEffect, useState } from 'react';
import Button from '../../../components/Button';
import { useQuill } from '../../QuillContext';
// TODO (merge-ok) Fix import cycle
// eslint-disable-next-line import/no-cycle
import { WalletSummary } from './WalletSummary';

export interface IWallet {
  address: string;
  name: string;
  ether: number;
  networks: number;
  tokens: number;
}

export const WalletsWrapper: FunctionComponent = () => {
  const { rpc } = useQuill();

  const [selected, setSelected] = useState<number>(0);
  const [wallets, setWallets] = useState<IWallet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const accounts = await rpc.public.eth_accounts();

      setWallets(
        accounts.map((address: string, index: number) => {
          return {
            address,
            name: `wallet ${index}`,
            ether: 0,
            networks: 1,
            tokens: 0,
          };
        }),
      );
      setLoading(false);

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
            window.location.reload();
          }}
          // TODO (merge-ok) Pass 'Add Wallet' as child
          // eslint-disable-next-line react/no-children-prop
          children={'Add Wallet'}
          className="btn-secondary"
        />
      </div>

      {loading ? (
        'Loading'
      ) : (
        <div className="flex flex-col gap-6 mt-8">
          {wallets.map((wallet, index) => (
            <WalletSummary
              onClick={() => {
                setSelected(index);
                rpc.private.quill_setSelectedAddress(wallet.address);
              }}
              key={wallet.name}
              wallet={wallet}
              expanded={index === selected}
            />
          ))}
        </div>
      )}
    </div>
  );
};
