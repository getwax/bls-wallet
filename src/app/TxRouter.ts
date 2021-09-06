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

  router.post(
    "transaction",
    TxHandler(async (ctx, tx) => {
      const failures = await txService.add(tx);

      if (failures.length > 0) {
        return fail(ctx, failures);
      }

      ctx.response.body = { failures: [] };
    }),
  );

  return router;
}

function TxHandler(fn: (ctx: RouterContext, tx: TransactionData) => void) {
  return JsonHandler(async (ctx, json) => {
    const parsedBody = parseTransactionDataDTO(json);

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

    const tx: TransactionData = {
      ...dto,
      nonce: BigNumber.from(dto.nonce),
      tokenRewardAmount: BigNumber.from(dto.tokenRewardAmount),
    };

    return await fn(ctx, tx);
  });
}

function JsonHandler(fn: (ctx: RouterContext, json: unknown) => void) {
  return async (ctx: RouterContext) => {
    const contentType = ctx.request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return fail(ctx, [
        { type: "invalid-format", description: "non-json content type" },
      ]);
    }

    const json = await (await ctx.request.body()).value;

    return await fn(ctx, json);
  };
}

function fail(ctx: RouterContext, failures: AddTransactionFailure[]) {
  assert(failures.length > 0);

  ctx.response.status = HTTPStatus.BadRequest;
  ctx.response.body = { failures };
}
