import {
  BigNumber,
  HTTPStatus,
  Router,
  RouterContext,
  TransactionData,
} from "../../deps.ts";
import assert from "../helpers/assert.ts";
import nil from "../helpers/nil.ts";
import AddTransactionFailure from "./AddTransactionFailure.ts";
import { parseTransactionDataDTO } from "./parsers.ts";

import TxService from "./TxService.ts";

export default function TxRouter(txService: TxService) {
  const router = new Router({ prefix: "/" });

  router.post("transaction", async (ctx) => {
    const tx = await parseTxOrFail(ctx);

    if (tx === nil) {
      return;
    }

    const failures = await txService.add(tx);

    if (failures.length > 0) {
      return fail(ctx, failures);
    }

    ctx.response.body = { failures: [] };
  });

  return router;
}

async function parseTxOrFail(
  ctx: RouterContext,
): Promise<TransactionData | nil> {
  const jsonBody = await parseJsonBodyOrFail(ctx);

  if (jsonBody === nil) {
    return nil;
  }

  const parsedBody = parseTransactionDataDTO(jsonBody);

  if ("failures" in parsedBody) {
    fail(
      ctx,
      parsedBody.failures.map(
        (description) => ({ type: "invalid-format", description }),
      ),
    );

    return nil;
  }

  const dto = parsedBody.success;

  return {
    ...dto,
    nonce: BigNumber.from(dto.nonce),
    tokenRewardAmount: BigNumber.from(dto.tokenRewardAmount),
  };
}

async function parseJsonBodyOrFail(ctx: RouterContext): Promise<unknown> {
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
