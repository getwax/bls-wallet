import { BigNumber, HTTPStatus, Router, RouterContext } from "../../deps.ts";
import assert from "../helpers/assert.ts";
import nil from "../helpers/nil.ts";
import AddTransactionFailure from "./AddTransactionFailure.ts";
import { parseTransactionData } from "./parsers.ts";

import TxService from "./TxService.ts";

export default function TxRouter(txService: TxService) {
  const router = new Router({ prefix: "/" });

  router.post("transaction", async (ctx) => {
    const body = await getJsonBodyOrFail(ctx);

    if (body === nil) {
      return;
    }

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

    const failures = await txService.add({
      ...txData,
      nonce: BigNumber.from(txData.nonce),
      tokenRewardAmount: BigNumber.from(txData.tokenRewardAmount),
    });

    if (failures.length > 0) {
      return fail(ctx, failures);
    }

    ctx.response.body = { failures: [] };
  });

  return router;
}

async function getJsonBodyOrFail(ctx: RouterContext): Promise<unknown> {
  const contentType = ctx.request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return fail(ctx, [
      { type: "invalid-format", description: "non-json content type" },
    ]);
  }

  return await (await ctx.request.body()).value;
}

function fail(ctx: RouterContext, failures: AddTransactionFailure[]) {
  assert(failures.length > 0);

  ctx.response.status = HTTPStatus.BadRequest;
  ctx.response.body = { failures };
}
