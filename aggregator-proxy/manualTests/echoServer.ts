import http from 'http';

import aggregatorProxy from "../src";

const requestListener = aggregatorProxy(
  'http://localhost:3020',
  b => {
    console.log('proxying bundle', JSON.stringify(b, null, 2));
    return b;
  },
);

http.createServer(requestListener).listen(8080, () => {
  console.log('Proxying aggregator on port 8080');
});
