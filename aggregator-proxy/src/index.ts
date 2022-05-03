import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { Bundle, bundleFromDto } from 'bls-wallet-clients';
import reporter from 'io-ts-reporters';

import BundleDto from './BundleDto';

export default function aggregatorProxy(
  upstreamAggregatorUrl: string,
  bundleTransformer: (clientBundle: Bundle) => Bundle,
) {
  const app = new Koa();

  const router = new Router();

  router.post('/bundle', bodyParser(), (ctx) => {
    console.log(ctx.request.body);
    const decodeResult = BundleDto.decode(ctx.request.body);

    if ('left' in decodeResult) {
      ctx.status = 400;
      ctx.body = reporter.report(decodeResult);
      return;
    }

    const clientBundle = bundleFromDto(decodeResult.right);
    const transformedBundle = bundleTransformer(clientBundle);

    ctx.status = 200;
    ctx.body = transformedBundle;
  });

  app.use(router.routes());

  return app.callback();
}
