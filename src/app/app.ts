import * as env from "./env.ts";
import Routers from "./Routers.ts";
import createKoaApp from "./createKoaApp.ts";
import TxService from "./TxService.ts";
import TxController from "./TxController.ts";
import AdminController from "./AdminController.ts";

const txService = await TxService.create(env.TX_TABLE_NAME);

const txController = new TxController(txService);
const adminController = new AdminController(txService);

const app = createKoaApp(Routers({ adminController, txController }));

const port = 3000;
console.log(`Listening on port ${port}...`);

await app.listen({ port: port });

// await db.client.disconnect();
