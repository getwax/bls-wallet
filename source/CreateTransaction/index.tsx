import * as React from 'react';
import ReactDOM from 'react-dom';

import CreateTransaction from './CreateTransaction';

import '../ContentScript/index';

ReactDOM.render(
  <CreateTransaction />,
  document.getElementById('create-transaction-root'),
);
