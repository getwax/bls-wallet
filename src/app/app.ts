import { Application } from "../../deps/index.ts";

import * as env from "./env.ts";
import WalletService from "./WalletService.ts";
import TxService from "./TxService.ts";
import TxRouter from "./TxRouter.ts";
import AdminRouter from "./AdminRouter.ts";
import AdminService from "./AdminService.ts";
import errorHandler from "./errorHandler.ts";
import notFoundHandler from "./notFoundHandler.ts";
import TxTable from "./TxTable.ts";
import createQueryClient from "./createQueryClient.ts";

const queryClient = createQueryClient();
const readyTxTable = await TxTable.create(queryClient, env.TX_TABLE_NAME);

const futureTxTable = await TxTable.create(
  queryClient,
  env.FUTURE_TX_TABLE_NAME,
);

const walletService = new WalletService(env.PRIVATE_KEY_AGG);
const txService = new TxService(futureTxTable, readyTxTable, walletService);

const adminService = new AdminService(
  walletService,
  readyTxTable,
  futureTxTable,
);

const routers = [
  TxRouter(txService),
  AdminRouter(adminService),
];

const app = new Application();

app.use(errorHandler);

for (const router of routers) {
  app.use(router.routes(), router.allowedMethods());
}

app.use(notFoundHandler);

app.addEventListener("listen", () => {
  console.log(`Listening on port ${env.PORT}...`);
});

await app.listen({ port: env.PORT });
