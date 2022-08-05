import { FunctionComponent, useMemo } from 'react';
import ICell from '../../../cells/ICell';
import MemoryCell from '../../../cells/MemoryCell';
import useCell from '../../../cells/useCell';
import Loading from '../../../components/Loading';
import onAction from '../../../helpers/onAction';
import { useQuill } from '../../../QuillContext';
import { AssetsTable } from './AssetsTable';
import { TransactionsTable } from './TransactionsTable';

export interface TokenData {
  token: string;
  tokenVal: number;
  usdVal: number;
  lastTx: string;
  action: string;
}

const data: TokenData[] = [
  {
    token: 'ETH',
    tokenVal: 0.835,
    usdVal: 3398.27,
    lastTx: '12/10/2021',
    action: 'Transfer',
  },
  {
    token: 'ENJ',
    tokenVal: 1220.18,
    usdVal: 398.27,
    lastTx: '12/10/2021',
    action: 'Transfer',
  },
  {
    token: 'USDT',
    tokenVal: 187.12,
    usdVal: 98.27,
    lastTx: '12/10/2021',
    action: 'Transfer',
  },
  {
    token: 'ETH',
    tokenVal: 0.835,
    usdVal: 3398.27,
    lastTx: '12/10/2021',
    action: 'Transfer',
  },
  {
    token: 'DAI',
    tokenVal: 717.64,
    usdVal: 717.27,
    lastTx: '12/10/2021',
    action: 'Transfer',
  },
  {
    token: 'OMG',
    tokenVal: 371.82,
    usdVal: 33098.27,
    lastTx: '12/10/2021',
    action: 'Transfer',
  },
];

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
    <div className="flex border-b border-grey-300 gap-4">
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
    () => new MemoryCell<'Assets' | 'Outbox' | 'Transactions'>('Transactions'),
    [],
  );

  const activeTabValue = useCell(activeTab);
  const selectedAddress = useCell(quill.cells.selectedAddress);

  const getTable = () => {
    if (activeTabValue === 'Assets') {
      return <AssetsTable data={data} />;
    }
    if (activeTabValue === 'Outbox') {
      return <div>Outbox</div>;
    }
    if (activeTabValue === 'Transactions') {
      return <TransactionsTable selectedAddress={selectedAddress || ''} />;
    }
    return <Loading />;
  };

  return (
    <div className="flex flex-col gap-4">
      <WalletTabs {...{ activeTab }} />

      <input placeholder="Search" />

      <div>
        <div>{getTable()}</div>
      </div>
    </div>
  );
};
