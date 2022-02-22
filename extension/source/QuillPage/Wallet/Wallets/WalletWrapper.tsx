import * as React from 'react';
import Button from '../../../components/Button';
import { WalletSummary } from './WalletSummary';

export interface IWallet {
  address: string;
  name: string;
  ether: number;
  networks: number;
  tokens: number;
}

const wallets: IWallet[] = [
  {
    address: '0x7fc9435a996e6f07e75c244bd9f345faaf81af8c',
    name: 'Wallet One',
    ether: 1.23,
    networks: 3,
    tokens: 3,
  },
  {
    address: '0x6db18d2e768dcf2606f7eb9a87d6b76874404a56',
    name: 'Wallet Two',
    ether: 2.35,
    networks: 2,
    tokens: 3,
  },
  {
    address: '0x68d135ae8bd3574b9e9ec101be5822fd5a1844b2',
    name: 'Main Wallet',
    ether: 5.54,
    networks: 1,
    tokens: 8,
  },
  {
    address: '0x68d135ae8bd3574b9e9ec101be5822fd1a1844c2',
    name: 'Main Wallet 2',
    ether: 10.54,
    networks: 3,
    tokens: 10,
  },
  {
    address: '0x6db18d2e768dcf2606f7eb9a87d6b76874404a56',
    name: 'Throwaway Wallet',
    ether: 0.04,
    networks: 2,
    tokens: 1,
  },
  {
    address: '0x9db18d2e768dcf2606f7eb9a87d6b76874404a56',
    name: 'Throwaway 2',
    ether: 0.01,
    networks: 1,
    tokens: 1,
  },
];

export const WalletsWrapper: React.FunctionComponent = () => {
  const [selected, setSelected] = React.useState<number>(0);

  return (
    <div className="">
      <div className="flex justify-between place-items-center">
        <div className="text-body">Wallets</div>
        <Button
          onPress={() => {}}
          children={'Add Wallet'}
          className="btn-secondary"
        />
      </div>

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
    </div>
  );
};
