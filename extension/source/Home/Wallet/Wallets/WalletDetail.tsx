import { FunctionComponent, useMemo } from 'react';
import ICell from '../../../cells/ICell';
import MemoryCell from '../../../cells/MemoryCell';
import useCell from '../../../cells/useCell';
import onAction from '../../../helpers/onAction';
import { useQuill } from '../../../QuillContext';
import DisplayNonce from './DisplayNonce';
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

type TabName = 'Assets' | 'Outbox' | 'Transactions';

const tabs: { name: TabName }[] = [
  { name: 'Assets' },
  { name: 'Outbox' },
  { name: 'Transactions' },
];

const WalletTabs: FunctionComponent<{ activeTab: ICell<TabName> }> = ({
  activeTab,
}) => {
  const activeTabValue = useCell(activeTab);

  return (
    <div className="flex border-b border-grey-300 gap-4 mb-4">
      {tabs.map((tab) => (
        <div
          key={tab.name}
          className={`py-2 px-4 cursor-pointer ${
            tab.name === activeTabValue &&
            'border-b-2 border-blue-500 text-blue-500'
          }`}
          {...onAction(() => activeTab.write(tab.name))}
        >
          {tab.name}
        </div>
      ))}
    </div>
  );
};

export const WalletDetail: FunctionComponent = () => {
  const quill = useQuill();

  const activeTab = useMemo(
    () => new MemoryCell<'Assets' | 'Outbox' | 'Transactions'>('Assets'),
    [],
  );

  const activeTabValue = useCell(activeTab);
  const selectedAddress = useCell(quill.cells.selectedAddress);

  return (
    <div className="">
      <WalletTabs {...{ activeTab }} />

      <input placeholder="Search" />

      {activeTabValue === 'Transactions' && selectedAddress && (
        <>
          Total: <DisplayNonce address={selectedAddress} />
        </>
      )}

      {/* <AssetsTable data={data} /> */}
      {/* <AssetsTable data={data} /> */}
      {/* <AssetsTable data={data} /> */}
    </div>
  );
};
