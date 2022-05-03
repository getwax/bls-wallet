import http from 'http';

import aggregatorProxy from "../src";

const requestListener = aggregatorProxy(
  '',
  b => b,
);

http.createServer(requestListener).listen(8080);
