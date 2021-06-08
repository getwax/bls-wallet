import Routers from "./Routers.ts";
import * as db from "./database.ts";
import createKoaApp from "./createKoaApp.ts";
import txService from "./txServiceInstance.ts";
import TxController from "./TxController.ts";

await db.initTables(txService);

const app = createKoaApp(Routers(new TxController(txService)));

const port = 3000;
console.log(`Listening on port ${port}...`);

await app.listen({ port: port });

// await db.client.disconnect();
