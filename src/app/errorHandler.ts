import { Middleware } from "../../deps/index.ts";

const errorHandler: Middleware = async ({ response }, nextFn) => {
  try {
    await nextFn();
  } catch (err) {
    response.status = 500;
    response.body = { msg: err.stack };
  }
};

export default errorHandler;
