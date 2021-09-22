import * as React from 'react';

import TransactionsScreen from './TransactionsScreen';

export const overrideScreenEnabled = true;

const OverrideScreen = (): React.ReactElement => <TransactionsScreen />;

export default OverrideScreen;
