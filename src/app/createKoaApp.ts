import { Application } from "../../deps/index.ts";
import AdminController from "./AdminController.ts";
import TxController from "./TxController.ts";

export default function createKoaApp({ adminController, txController }: {
  adminController: AdminController;
  txController: TxController;
}) {
  const app = new Application();

  app.use(async ({ response }, nextFn) => {
    try {
      await nextFn();
    } catch (err) {
      response.status = 500;
      response.body = { msg: err.stack };
    }
  });

  txController.useWith(app);
  adminController.useWith(app);

  app.use(({ response }) => {
    response.status = 404;
    response.body = { msg: "Not Found" };
  });

  return app;
}
