import { Application } from "./deps.ts";

import { adminRouter, txRouter } from "./routes.ts";
import * as db from "./database.ts";

await db.initTables();

const app = new Application();

app.use(txRouter.routes());
app.use(txRouter.allowedMethods());

app.use(adminRouter.routes());
app.use(adminRouter.allowedMethods());

app.use(({ response }) => {
  response.status = 404;
  response.body = { msg: "Not Found" };
});
app.use(async ({ response }, nextFn) => {
  try {
    await nextFn();
  } catch (err) {
    response.status = 500;
    response.body = { msg: err.message };
  }
});

const port = 3000;
console.log(`Listening on port ${port}...`);

await app.listen({ port: port });

await db.client.disconnect();
