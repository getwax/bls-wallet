import Koa from 'koa';
import Router from '@koa/router';
import { Bundle } from 'bls-wallet-clients';

export default function aggregatorProxy(
  upstreamAggregatorUrl: string,
  bundleTransformer: (clientBundle: Bundle) => Bundle,
) {
  const app = new Koa();
  const router = new Router();

  router.post('/bundle', (ctx) => {
    // TODO: transform bundle and post to upstream aggregator
  });

  app.use(router.routes());

  return app.callback();
}
