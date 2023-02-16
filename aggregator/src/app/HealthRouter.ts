import { Router } from "../../deps.ts";
import {HealthService} from "./HealthService.ts";

export default function healthRouter(healthService: HealthService) {
  const router = new Router({ prefix: "/" });

  router.get("health", async (ctx) => {
    const healthResults = await healthService.getHealth();
    console.log(`Status: ${healthResults.ResourceHealth}\n`);
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = healthResults.ResourceHealth;
    // ctx.response.status = healthResults.status === ResourceHealth.Healthy ? 200 : 503
    /* 
        res.status(healthResults.status === ResourceHealth.Healthy ? 200 : 503)
      .send({
        status: healthResults.status, dependencies: healthResults.results
      });
    */
  });
  return router;
}

/* 

  const healthService = new HealthService(
    [
      new SomeServiceCheck(),
      // Add more checks here...
    ]
  );
*/