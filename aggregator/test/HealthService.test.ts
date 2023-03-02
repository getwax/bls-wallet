import { assertEquals } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

Fixture.test("HealthService returns healthy", async (fx) => {
  const bundleService = fx.createBundleService();
  const healthCheckService = fx.createHealthCheckService(bundleService.bundleTable)
  const healthStatus = await healthCheckService.getHealth();
  const expected = {"status":"HEALTHY","dependencies":[{"name":"DB","status":"HEALTHY"},{"name":"RPC","status":"HEALTHY"}]};
  assertEquals(JSON.stringify(healthStatus), JSON.stringify(expected));
});