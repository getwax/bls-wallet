import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { Bundle } from 'bls-wallet-clients';

export default function aggregatorProxy(
  upstreamAggregatorUrl: string,
  bundleTransformer: (clientBundle: Bundle) => Bundle,
) {
  const app = new Koa();

  const router = new Router();

  router.post('/bundle', bodyParser(), (ctx) => {
    console.log(ctx.request.body);
    ctx.status = 200;
    ctx.body = 'todo';
  });

  app.use(router.routes());

  return app.callback();
}
