import { FunctionComponent } from 'react';

import type { SendState } from './SendDetail';

const SendProgress: FunctionComponent<{ state: SendState }> = ({ state }) => {
  return <pre>{JSON.stringify(state, null, 2)}</pre>;
};

export default SendProgress;
