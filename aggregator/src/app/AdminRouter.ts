import { Router } from "../../deps.ts";

import AdminService from "./AdminService.ts";

export default function AdminRouter(adminService: AdminService) {
  const router = new Router({ prefix: "/admin/" });

  router.get("countTxs", async (ctx) => {
    const c = await adminService.txCount();
    console.log(`Returning count ${c}\n`);
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = c;
  });

  router.get("resetTxs", async (ctx) => {
    await adminService.resetTxs();
    ctx.response.body = "Transactions reset";
  });

  return router;
}
