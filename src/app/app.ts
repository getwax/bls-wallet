import Routers from "./Routers.ts";
import * as db from "./database.ts";
import createKoaApp from "./createKoaApp.ts";
import txService from "./txServiceInstance.ts";
import TxController from "./TxController.ts";
import AdminController from "./AdminController.ts";

const txController = new TxController(txService);
const adminController = new AdminController();

await db.initTables(txService);

const app = createKoaApp(Routers({ adminController, txController }));

const port = 3000;
console.log(`Listening on port ${port}...`);

await app.listen({ port: port });

// await db.client.disconnect();
