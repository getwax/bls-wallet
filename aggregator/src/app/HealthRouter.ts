import { Router } from "../../deps.ts";
import HealthService from "./HealthService.ts";

export default function HealthRouter(healthService: HealthService) {
  const router = new Router({ prefix: "/" });

  router.get(
    "health", 
    async (ctx) => {
      const healthResults = await healthService.getHealth();
      console.log(`Status: ${healthResults.status}\n`);
      ctx.response.status = healthResults.status == 'healthy' ? 200 : 503;
      ctx.response.body = { status: healthResults.status, dependencies: healthResults.dependencies };
  });
  return router;
}