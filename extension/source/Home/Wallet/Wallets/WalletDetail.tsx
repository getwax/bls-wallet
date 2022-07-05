import * as React from 'react';
import onAction from '../../../helpers/onAction';
// import { AssetsTable } from './AssetsTable';

export interface TokenData {
  token: string;
  tokenVal: number;
  usdVal: number;
  lastTx: string;
  action: string;
}

// const data: TokenData[] = [
//   {
//     token: 'ETH',
//     tokenVal: 0.835,
//     usdVal: 3398.27,
//     lastTx: '12/10/2021',
//     action: 'Transfer',
//   },
//   {
//     token: 'ENJ',
//     tokenVal: 1220.18,
//     usdVal: 398.27,
//     lastTx: '12/10/2021',
//     action: 'Transfer',
//   },
//   {
//     token: 'USDT',
//     tokenVal: 187.12,
//     usdVal: 98.27,
//     lastTx: '12/10/2021',
//     action: 'Transfer',
//   },
//   {
//     token: 'ETH',
//     tokenVal: 0.835,
//     usdVal: 3398.27,
//     lastTx: '12/10/2021',
//     action: 'Transfer',
//   },
//   {
//     token: 'DAI',
//     tokenVal: 717.64,
//     usdVal: 717.27,
//     lastTx: '12/10/2021',
//     action: 'Transfer',
//   },
//   {
//     token: 'OMG',
//     tokenVal: 371.82,
//     usdVal: 33098.27,
//     lastTx: '12/10/2021',
//     action: 'Transfer',
//   },
// ];

const tabs = [{ name: 'Assets' }, { name: 'Outbox' }, { name: 'Transactions' }];

const WalletTabs: React.FunctionComponent = () => {
  const [activeTab, setActiveTab] = React.useState<string>('Assets');

  return (
    <div className="flex border-b border-grey-300 gap-4 mb-4">
      {tabs.map((tab) => (
        <div
          key={tab.name}
          className={`py-2 px-4 cursor-pointer ${
            tab.name === activeTab && 'border-b-2 border-blue-500 text-blue-500'
          }`}
          {...onAction(() => setActiveTab(tab.name))}
        >
          {tab.name}
        </div>
      ))}
    </div>
  );
};

export const WalletDetail: React.FunctionComponent = () => {
  return (
    <div className="">
      <WalletTabs />

      <input placeholder="Search" />

      {/* <AssetsTable data={data} /> */}
      {/* <AssetsTable data={data} /> */}
      {/* <AssetsTable data={data} /> */}
    </div>
  );
};
