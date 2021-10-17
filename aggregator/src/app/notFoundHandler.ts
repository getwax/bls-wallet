import { Middleware } from "../../deps.ts";

const notFoundHandler: Middleware = ({ response }) => {
  response.status = 404;
  response.body = { msg: "Not Found" };
};

export default notFoundHandler;
