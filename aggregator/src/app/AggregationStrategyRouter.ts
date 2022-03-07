import { Router } from "../../deps.ts";
import BundleHandler from "./helpers/BundleHandler.ts";

import AggregationStrategy from "./AggregationStrategy.ts";
import AsyncReturnType from "../helpers/AsyncReturnType.ts";
import ClientReportableError from "./helpers/ClientReportableError.ts";

export default function AggregationStrategyRouter(
  aggregationStrategy: AggregationStrategy,
) {
  const router = new Router({ prefix: "/" });

  router.post(
    "estimateFee",
    BundleHandler(async (ctx, bundle) => {
      let result: AsyncReturnType<AggregationStrategy["estimateFee"]>;

      try {
        result = await aggregationStrategy.estimateFee(bundle);
      } catch (error) {
        if (error instanceof ClientReportableError) {
          ctx.response.status = 500;
          ctx.response.body = error.message;
          return;
        }

        throw error;
      }

      ctx.response.body = result;
    }),
  );

  return router;
}
