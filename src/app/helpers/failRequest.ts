import { HTTPStatus, RouterContext } from "../../../deps.ts";
import assert from "../../helpers/assert.ts";

export default function failRequest(
  ctx: RouterContext,
  failures: unknown[],
) {
  assert(failures.length > 0);

  ctx.response.status = HTTPStatus.BadRequest;
  ctx.response.body = { failures };
}
