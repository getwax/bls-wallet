import { runAggregatorProxy } from "../src";

runAggregatorProxy(
  'https://arbitrum-testnet.blswallet.org',
  b => {
    console.log('proxying bundle', JSON.stringify(b, null, 2));
    return b;
  },
  8080,
  '0.0.0.0',
  () => {
    console.log('Proxying aggregator on port 8080');
  },
);
