import * as env from "./env.ts";
import createKoaApp from "./createKoaApp.ts";
import WalletService from "./WalletService.ts";
import TxService from "./TxService.ts";
import TxController from "./TxController.ts";
import AdminController from "./AdminController.ts";
import AdminService from "./AdminService.ts";

const walletService = new WalletService();
const txService = await TxService.create(env.TX_TABLE_NAME);
const adminService = new AdminService(walletService, txService);

const txController = new TxController(walletService, txService);
const adminController = new AdminController(adminService);

const app = createKoaApp({ adminController, txController });

await app.listen({ port: env.PORT });
console.log(`Listening on port ${env.PORT}...`);

// await db.client.disconnect();
