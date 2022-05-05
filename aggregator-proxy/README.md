# Aggregator Proxy

## Usage

```ts
import {
  runAggregatorProxy,

  // AggregatorProxyCallback,
  // ^ Alternatively, for manual control, import AggregatorProxyCallback to
  // just generate the req,res callback for use with http.createServer
} from 'aggregator-proxy';

runAggregatorProxy(
  'https://arbitrum-testnet.blswallet.org',
  async bundle => {
    console.log('proxying bundle', JSON.stringify(bundle, null, 2));

    // Return a different/augmented bundle to send to the upstream aggregator
    return bundle;
  },
  8080,
  '0.0.0.0',
  () => {
    console.log('Proxying aggregator on port 8080');
  },
);
```
