import { adminRouter, txRouter } from "./routes.ts";
import * as db from "./database.ts";
import createKoaApp from "./createKoaApp.ts";

await db.initTables();

const app = createKoaApp({ adminRouter, txRouter });

const port = 3000;
console.log(`Listening on port ${port}...`);

await app.listen({ port: port });

// await db.client.disconnect();
