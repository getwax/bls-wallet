import { FunctionComponent, useEffect, useState } from 'react';
import Button from '../../../components/Button';
import { WalletSummary } from './WalletSummary';

export interface IWallet {
  address: string;
  name: string;
  ether: number;
  networks: number;
  tokens: number;
}

export const WalletsWrapper: FunctionComponent = () => {
  const [selected, setSelected] = useState<number>(0);
  const [wallets, setWallets] = useState<IWallet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);

    // @ts-ignore
    const wallets = window.quillController.keyringController.getAccounts();

    setWallets(
      wallets.map((wallet: string, index: number) => {
        return {
          address: wallet,
          name: `wallet ${index}`,
          ether: 0,
          networks: 1,
          tokens: 0,
        };
      }),
    );
    setLoading(false);

    // @ts-ignore
  }, []);

  return (
    <div className="">
      <div className="flex justify-between place-items-center">
        <div className="text-body">Wallets</div>
        <Button
          onPress={async () => {
            // @ts-ignore
            await window.quillController.keyringController.createHDAccount();
            // @ts-ignore
            window.location.reload();
          }}
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
              onClick={() => setSelected(index)}
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
