import { Bundle, RouterContext } from "../../../deps.ts";
import nil from "../../helpers/nil.ts";
import { parseBundleDto } from "../parsers.ts";
import failRequest from "./failRequest.ts";
import JsonHandler from "./JsonHandler.ts";

export default function BundleHandler(
  fn: (ctx: RouterContext, bundle: Bundle) => Promise<void>,
) {
  return JsonHandler((ctx, json) => {
    const parsedBody = parseBundleDto(json);

    if ("failures" in parsedBody) {
      failRequest(
        ctx,
        parsedBody.failures.map(
          (description) => ({ type: "invalid-format", description }),
        ),
      );

      return nil;
    }

    const dto = parsedBody.success;
    const bun: Bundle = {
      ...dto,
    };

    return fn(ctx, bun);
  });
}
