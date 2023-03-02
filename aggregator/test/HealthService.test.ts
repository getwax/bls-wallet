import { assertEquals } from "./deps.ts";

import Fixture from "./helpers/Fixture.ts";

// TODO: This test is not working. It is waiting for the async function to complete.
Fixture.test("HealthService returns healthy", async (fx) => {
  const bundleService = fx.createBundleService();
  const healthCheckService = fx.createHealthCheckService(bundleService.bundleTable)
  const healthStatus = await healthCheckService.getHealth();
  const expected = {"status":"HEALTHY","dependencies":[{"name":"DB","status":"HEALTHY"},{"name":"RPC","status":"HEALTHY"}]};
  assertEquals(JSON.stringify(healthStatus), JSON.stringify(expected));
});