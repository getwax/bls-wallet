import { Application } from "../../deps.ts";

import * as env from "../env.ts";
import WalletService from "./WalletService.ts";
import TxService from "./TxService.ts";
import TxRouter from "./TxRouter.ts";
import AdminRouter from "./AdminRouter.ts";
import AdminService from "./AdminService.ts";
import errorHandler from "./errorHandler.ts";
import notFoundHandler from "./notFoundHandler.ts";
import TxTable from "./TxTable.ts";
import createQueryClient from "./createQueryClient.ts";
import Mutex from "../helpers/Mutex.ts";
import Clock from "../helpers/Clock.ts";
import AppEvent from "./AppEvent.ts";
import WalletRouter from "./WalletRouter.ts";

export default async function app(emit: (evt: AppEvent) => void) {
  const clock = Clock.create();

  const queryClient = createQueryClient(emit);

  const txTablesMutex = new Mutex();

  const readyTxTable = await TxTable.create(queryClient, env.TX_TABLE_NAME);

  const futureTxTable = await TxTable.create(
    queryClient,
    env.FUTURE_TX_TABLE_NAME,
  );

  const walletService = await WalletService.create(emit, env.PRIVATE_KEY_AGG);

  const txService = new TxService(
    emit,
    clock,
    queryClient,
    txTablesMutex,
    readyTxTable,
    futureTxTable,
    walletService,
  );

  const adminService = new AdminService(
    walletService,
    readyTxTable,
    futureTxTable,
  );

  const routers = [
    TxRouter(txService),
    WalletRouter(walletService),
    AdminRouter(adminService),
  ];

  const app = new Application();

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
