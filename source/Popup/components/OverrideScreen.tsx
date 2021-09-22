import * as React from 'react';
import App from '../App';

import TransactionsScreen from './TransactionsScreen';

export const overrideScreenEnabled = true;

const OverrideScreen = (props: { app: App }): React.ReactElement => (
  <TransactionsScreen app={props.app} />
);

export default OverrideScreen;
