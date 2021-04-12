import { Application } from "./deps.ts";

import { txRouter /*, adminRouter*/ } from "./routes.ts";
import { client } from "./database.ts";

const app = new Application();

app.use(txRouter.routes());
app.use(txRouter.allowedMethods());
// app.use(adminRouter.routes());
// app.use(adminRouter.allowedMethods());
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

// await client.connect();

console.log(`Listening on port...`);

await app.listen({ port: 3000 });

await client.disconnect();
