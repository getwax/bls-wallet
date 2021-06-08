import { Application, Router } from "../../deps/index.ts";

export default function createKoaApp({ adminRouter, txRouter }: {
  adminRouter: Router;
  txRouter: Router;
}) {
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

  return app;
}
