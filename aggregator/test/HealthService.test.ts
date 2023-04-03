import { assertEquals } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("HealthService returns healthy", async (fx) => {
  const healthCheckService = fx.createHealthCheckService()
  const healthStatus = await healthCheckService.getHealth();
  const expected = {"status":"HEALTHY"};
  assertEquals(JSON.stringify(healthStatus), JSON.stringify(expected));
});