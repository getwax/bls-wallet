import { RouterContext } from "../../../deps.ts";
import failRequest from "./failRequest.ts";

export default function JsonHandler(
  fn: (ctx: RouterContext, json: unknown) => void,
) {
  return async (ctx: RouterContext) => {
    const contentType = ctx.request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return failRequest(ctx, [
        { type: "invalid-format", description: "non-json content type" },
      ]);
    }

    const json = await (await ctx.request.body()).value;

    return await fn(ctx, json);
  };
}
