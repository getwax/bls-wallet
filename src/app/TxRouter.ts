import { HTTPStatus, Router, RouterContext } from "../../deps/index.ts";
import assert from "../helpers/assert.ts";
import AddTransactionFailure from "./AddTransactionFailure.ts";
import { parseTransactionData } from "./parsers.ts";

import TxService from "./TxService.ts";

function fail(ctx: RouterContext, failures: AddTransactionFailure[]) {
  assert(failures.length > 0);

  ctx.response.status = HTTPStatus.BadRequest;
  ctx.response.body = { failures };
}

export default function TxRouter(txService: TxService) {
  const router = new Router({ prefix: "/" });

  router.post("transaction", async (ctx) => {
    const body: unknown = await (await ctx.request.body()).value;

    const parsedBody = parseTransactionData(body);

    if ("failures" in parsedBody) {
      return fail(
        ctx,
        parsedBody.failures.map(
          (description) => ({ type: "invalid-format", description }),
        ),
      );
    }

    const txData = parsedBody.success;

    const failures = await txService.add(txData);

    if (failures.length > 0) {
      return fail(ctx, failures);
    }

    ctx.response.body = { failures: [] };
  });

  return router;
}
