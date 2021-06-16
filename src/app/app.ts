import { Application } from "../../deps/index.ts";

import * as env from "./env.ts";
import WalletService from "./WalletService.ts";
import TxService from "./TxService.ts";
import TxController from "./TxController.ts";
import AdminController from "./AdminController.ts";
import AdminService from "./AdminService.ts";
import errorHandler from "./errorHandler.ts";
import notFoundHandler from "./notFoundHandler.ts";
import TxTable from "./TxTable.ts";

const walletService = new WalletService(env.PRIVATE_KEY_AGG);
const txTable = await TxTable.create(env.TX_TABLE_NAME);
const txService = new TxService(txTable);
const adminService = new AdminService(walletService, txTable);

const txController = new TxController(txService);
const adminController = new AdminController(adminService);

const app = new Application();

app.use(errorHandler);

txController.useWith(app);
adminController.useWith(app);

app.use(notFoundHandler);

app.addEventListener("listen", () => {
  console.log(`Listening on port ${env.PORT}...`);
});

await app.listen({ port: env.PORT });
