import * as env from "./env.ts";
import Routers from "./Routers.ts";
import createKoaApp from "./createKoaApp.ts";
import WalletService from "./WalletService.ts";
import TxService from "./TxService.ts";
import TxController from "./TxController.ts";
import AdminController from "./AdminController.ts";

const walletService = new WalletService();
const txService = await TxService.create(env.TX_TABLE_NAME);

const txController = new TxController(walletService, txService);
const adminController = new AdminController(walletService, txService);

const app = createKoaApp(Routers({ adminController, txController }));

await app.listen({ port: env.PORT });
console.log(`Listening on port ${env.PORT}...`);

// await db.client.disconnect();
