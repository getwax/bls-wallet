import * as React from 'react';

import App from '../../App';
import CompactQuillHeading from '../../components/CompactQuillHeading';
import Tabs from './Tabs';
import TransactionTab from './TransactionTab';

const TransactionsScreen = (props: { app: App }): React.ReactElement => (
  <div className="transactions-screen">
    <CompactQuillHeading />
    <Tabs
      content={[
        ['Transaction', <TransactionTab app={props.app} key={1} />],
        ['Outbox', <>Not implemented</>],
      ]}
    />
  </div>
);

export default TransactionsScreen;
