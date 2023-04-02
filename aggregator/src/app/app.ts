import { Application, oakCors, sqlite } from "../../deps.ts";

import * as env from "../env.ts";
import EthereumService from "./EthereumService.ts";
import BundleService from "./BundleService.ts";
import BundleRouter from "./BundleRouter.ts";
import AdminRouter from "./AdminRouter.ts";
import AdminService from "./AdminService.ts";
import errorHandler from "./errorHandler.ts";
import notFoundHandler from "./notFoundHandler.ts";
import Mutex from "../helpers/Mutex.ts";
import Clock from "../helpers/Clock.ts";
import getNetworkConfig from "../helpers/getNetworkConfig.ts";
import AppEvent from "./AppEvent.ts";
import BundleTable from "./BundleTable.ts";
import AggregationStrategy from "./AggregationStrategy.ts";
import AggregationStrategyRouter from "./AggregationStrategyRouter.ts";
import HealthService, {DBServiceHealthCheck, ServiceHealthCheck} from "./HealthService.ts";
import HealthRouter from "./HealthRouter.ts";

export default async function app(emit: (evt: AppEvent) => void) {
  const { addresses } = await getNetworkConfig();

  const clock = Clock.create();

  const bundleTableMutex = new Mutex();

  const bundleTable = new BundleTable(
    new sqlite.DB(env.DB_PATH),
    (sql, params) => {
      if (env.LOG_QUERIES) {
        emit({
          type: "db-query",
          data: { sql, params },
        });
      }
    },
  );

  const ethereumService = await EthereumService.create(
    emit,
    addresses.verificationGateway,
    addresses.utilities,
    env.PRIVATE_KEY_AGG,
  );

  const aggregationStrategy = new AggregationStrategy(
    ethereumService.blsWalletSigner,
    ethereumService,
    AggregationStrategy.defaultConfig,
    emit,
  );

  const bundleService = new BundleService(
    emit,
    clock,
    bundleTableMutex,
    bundleTable,
    ethereumService.blsWalletSigner,
    ethereumService,
    aggregationStrategy,
  );

  const adminService = new AdminService(
    ethereumService,
    bundleTable,
  );

  const dbServiceHealthCheck = new DBServiceHealthCheck(bundleTable);
  const rpcServiceHealthCheck = new ServiceHealthCheck('RPC', env.RPC_URL);
  const aggregatorServiceHealthCheck = new ServiceHealthCheck('Aggregator', new URL('/Bundle/health', env.ORIGIN).toString());
  const healthService = new HealthService(
    [
      dbServiceHealthCheck,
      rpcServiceHealthCheck,
      aggregatorServiceHealthCheck,
    ]
  )

  const routers = [
    BundleRouter(bundleService),
    AdminRouter(adminService),
    AggregationStrategyRouter(aggregationStrategy),
    HealthRouter(healthService),
  ];

  const app = new Application();
  app.use(oakCors()); // Enables CORS for all routes

  app.use(async (ctx, next) => {
    const startTime = Date.now();

    emit({
      type: "request-start",
      data: {
        method: ctx.request.method,
        path: ctx.request.url.pathname,
      },
    });

    await next();

    emit({
      type: "request-end",
      data: {
        method: ctx.request.method,
        path: ctx.request.url.pathname,
        status: ctx.response.status,
        duration: Date.now() - startTime,
      },
    });
  });

  app.use(errorHandler);

  for (const router of routers) {
    app.use(router.routes(), router.allowedMethods());
  }

  app.use(notFoundHandler);

  app.addEventListener("listen", () => {
    emit({ type: "listening", data: { port: env.PORT } });
  });

  await app.listen({ port: env.PORT });
}
