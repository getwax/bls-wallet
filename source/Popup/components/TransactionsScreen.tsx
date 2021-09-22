import * as React from 'react';
import Range from '../../helpers/Range';
import CompactQuillHeading from './CompactQuillHeading';
import Tabs from './Tabs';

const TransactionsScreen = (): React.ReactElement => (
  <div className="transactions-screen">
    <CompactQuillHeading />
    <Tabs
      content={[
        [
          'A',
          <>
            {Range(100).map((i) => (
              <div key={i}>{i}</div>
            ))}
            Tab A
          </>,
        ],
        ['B', <>Tab B</>],
        ['C', <>Tab C</>],
      ]}
      defaultTab="A"
    />
  </div>
);

export default TransactionsScreen;
