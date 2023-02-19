import { axiod } from "../../deps.ts";
import BundleTable from "./BundleTable.ts";
import AppEvent from "./AppEvent.ts";
import assert from "../helpers/assert.ts";
import * as env from "../env.ts";

abstract class HealthIndicator {
  constructor(
    public emit: (evt: AppEvent) => void,
  ){}
  abstract name: string;
  status: ResourceHealth = ResourceHealth.Unhealthy;
  details: string | undefined;

  abstract checkHealth(): Promise<void>;
}

export enum ResourceHealth {
  Healthy = 'HEALTHY',
  Unhealthy = 'UNHEALTHY'
}

export class AggregatorServiceHealthCheck extends HealthIndicator {
  // Starts out in the Unhealthy state by default until it can be verified as Healthy
  name: string = 'Aggregator';
  status: ResourceHealth = ResourceHealth.Unhealthy;
  details: string | undefined;
  
  async checkHealth(): Promise<void> {
    try {
      const response = await axiod.get(new URL(env.ORIGIN, "/Bundle/health").toString());
      if (response.status === 200) {
        this.status = ResourceHealth.Healthy;
        this.emit({
          type: "service-healthy",
          data: {
            name: this.name,
            status: ResourceHealth.Healthy,
          },
        });
      } else {
        this.status = ResourceHealth.Unhealthy;
        this.details = `Aggregator returned status code ${response.status}`;
        this.emit({
          type: "service-unhealthy",
          data: {
            name: this.name,
            status: ResourceHealth.Unhealthy,
            detail: `Aggregator returned status code ${response.status}`,
          },
        });
      }
    } catch (e) {
      this.status = ResourceHealth.Unhealthy;
      this.details = e.message;
      this.emit({
        type: "service-unhealthy",
        data: {
          name: this.name,
          status: ResourceHealth.Unhealthy,
          detail: e.message,
        },
      });
      //console.log(`HEALTH: ${this.name} is unhealthy.`, e.message);
    }
  }
}

export class RPCServiceHealthCheck extends HealthIndicator  {
  // Starts out in the Unhealthy state by default until it can be verified as Healthy
  name: string = 'RPC';
  status: ResourceHealth = ResourceHealth.Unhealthy;
  details: string | undefined;

  async checkHealth(): Promise<void> {
    try {
      const response = await axiod.get(env.RPC_URL);
      if (response.status === 200) {
        this.status = ResourceHealth.Healthy;
        this.emit({
          type: "service-healthy",
          data: {
            name: this.name,
            status: ResourceHealth.Healthy,
          },
        });
      } else {
        this.status = ResourceHealth.Unhealthy;
        this.details = `RPC returned status code ${response.status}`;
        this.emit({
          type: "service-unhealthy",
          data: {
            name: this.name,
            status: ResourceHealth.Unhealthy,
            detail: `RPC returned status code ${response.status}`,
          },
        });
      }
    } catch (e) {
      this.status = ResourceHealth.Unhealthy;
      this.details = e.message;
      this.emit({
        type: "service-unhealthy",
        data: {
          name: this.name,
          status: ResourceHealth.Unhealthy,
          detail: e.message,
        },
      });
      //console.log(`HEALTH: ${this.name} is unhealthy.`, e.message);
    }
  }
}

export class DBServiceHealthCheck extends HealthIndicator  {
  constructor(
    public emit: (evt: AppEvent) => void,
    private bundleTable: BundleTable,
  ){
    super(emit);
  }

  // Starts out in the Unhealthy state by default until it can be verified as Healthy
  name: string = 'DB';
  status: ResourceHealth = ResourceHealth.Unhealthy;
  details: string | undefined;

  async checkHealth(): Promise<void> {
    try {      
      const [[now]] = [...this.bundleTable.dbQuery("SELECT STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')")];
      const dbTime = new Date(`${now}Z`).getTime();
      assert(typeof dbTime === "number");
      this.status = ResourceHealth.Healthy;
      this.emit({
        type: "service-healthy",
        data: {
          name: this.name,
          status: ResourceHealth.Healthy,
        },
      });
    } catch (e) {
      this.status = ResourceHealth.Unhealthy;
      this.details = e.message;
      this.emit({
        type: "service-unhealthy",
        data: {
          name: this.name,
          status: ResourceHealth.Unhealthy,
          detail: e.message,
        },
      });
      //console.log(`HEALTH: ${this.name} is unhealthy.`, e.message);
    }
  }
}

export default class HealthService {
  public overallHealth: ResourceHealth = ResourceHealth.Healthy;
  
  constructor(
    public emit: (evt: AppEvent) => void,
    private readonly checks: HealthIndicator[],
  ){
    this.checks = checks;
  }

  async getHealth(): Promise<HealthCheckResult> {
    await Promise.all(
      this.checks.map(check => check.checkHealth())
    );

    const anyUnhealthy = this.checks.some(item =>
      item.status === ResourceHealth.Unhealthy
    );
    this.overallHealth = anyUnhealthy
      ? ResourceHealth.Unhealthy
      : ResourceHealth.Healthy;
          
    return {
      status: this.overallHealth,
      results: this.checks.map(check => ({
        name: check.name,
        status: check.status,
      }))
    };
  }
}

type HealthCheckResult = {
  status: ResourceHealth,
  results: {
    name: string,
    status: ResourceHealth
  }[]
};