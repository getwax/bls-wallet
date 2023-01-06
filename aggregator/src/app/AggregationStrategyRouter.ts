import { Router } from "../../deps.ts";
import BundleHandler from "./helpers/BundleHandler.ts";

import AggregationStrategy from "./AggregationStrategy.ts";
import AsyncReturnType from "../helpers/AsyncReturnType.ts";
import ClientReportableError from "./helpers/ClientReportableError.ts";
import nil from "../helpers/nil.ts";
import never from "./helpers/never.ts";

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

      ctx.response.body = {
        feeType: (() => {
          const feesConfig = aggregationStrategy.config.fees;

          if (feesConfig === nil || feesConfig.type === "ether") {
            return "ether";
          }

          if (feesConfig.type === "token") {
            return `token:${feesConfig.address}`;
          }

          never(feesConfig);
        })(),
        feeDetected: result.feeDetected.toString(),
        feeRequired: result.feeRequired.toString(),
        successes: result.successes,
      };
    }),
  );

  return router;
}
