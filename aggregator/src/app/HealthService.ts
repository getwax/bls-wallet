import BundleTable from "./BundleTable.ts";
import assert from "../helpers/assert.ts";

export type ResourceHealth = 'healthy' | 'unhealthy';

type HealthIndicator = {
  name: string;
  status: ResourceHealth;
  details?: string;
  checkHealth(): Promise<void> | void;
};

export class ServiceHealthCheck implements HealthIndicator {
  // Starts out in the Unhealthy state by default until it can be verified as Healthy
  name: string;
  status: ResourceHealth = 'unhealthy';
  details: string | undefined;
  url: string;

  constructor(name: string, url: string) {
    this.name = name;
    this.url = url;
  }

  async checkHealth(): Promise<void> {
    try {
      const response = await fetch(this.url); 

      if (response.status === 200) {
        this.status = 'healthy';
      } else {
        this.status = 'unhealthy';
        this.details = `${this.name} returned status code ${response.status}`;
      }
    } catch (e) {
      this.status = 'unhealthy';
      this.details = e.message;
    }
  }
}

export class DBServiceHealthCheck implements HealthIndicator  {
  constructor(
    private bundleTable: BundleTable,
  ){}
  // Starts out in the Unhealthy state by default until it can be verified as Healthy
  name = 'DB';
  status: ResourceHealth = 'unhealthy';
  details?: string | undefined;

  checkHealth(): void {
      try {      
        const [[now]] = this.bundleTable.dbQuery("SELECT STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')");
        const dbTime = new Date(`${now}Z`).getTime();
        assert(typeof dbTime === "number");
        this.status = 'healthy';
      } catch (e) {
        this.status = 'unhealthy';
        this.details = e.message;
      }
  }
}

type HealthCheckResult = {
  status: ResourceHealth,
  dependencies: {
    name: string,
    status: ResourceHealth
  }[]
};

export default class HealthService {
  public overallHealth: ResourceHealth = 'healthy';
  
  constructor(
    private readonly checks: HealthIndicator[],
  ){
    this.checks = checks;
  }

  async getHealth(): Promise<HealthCheckResult> {
    await Promise.all(
      this.checks.map(check => check.checkHealth())
    );

    const anyUnhealthy = this.checks.some(item =>
      item.status === 'unhealthy'
    );
    this.overallHealth = anyUnhealthy
      ? 'unhealthy'
      : 'healthy';
          
    return {
      status: this.overallHealth,
      dependencies: this.checks.map(check => ({
        name: check.name,
        status: check.status,
      }))
    };
  }
}