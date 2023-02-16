import axios, { AxiosError, AxiosResponse } from 'axios' // 改dep.ts "../../deps.ts";
import BundleTable from "./BundleTable.ts";
import AppEvent from "./AppEvent.ts";
import assert from "../helpers/assert.ts";

// https://www.elliotdenolf.com/blog/standardized-health-checks-in-typescript
// https://ithelp.ithome.com.tw/articles/10216626
// https://stackoverflow.com/questions/42532534/why-do-we-await-next-when-using-koa-routers

abstract class HealthIndicator {
  constructor(
    public emit: (evt: AppEvent) => void,
  ){}
  abstract name: string;
  status: ResourceHealth = ResourceHealth.Unhealthy;
  details: string | undefined;

  abstract checkHealth(): Promise<void>;
}

enum ResourceHealth {
  Healthy = 'HEALTHY',
  Unhealthy = 'UNHEALTHY'
}

export class RPCServiceHealthCheck extends HealthIndicator  {
  // Starts out in the Unhealthy state by default until it can be verified as Healthy
  name: string = 'RPC';
  status: ResourceHealth = ResourceHealth.Unhealthy; // TODO ?? keep?
  details: string | undefined;

  async checkHealth(): Promise<void> {
    let result: AxiosResponse<any>;
    try {
      const pingURL = `http://localhost:8080/ping`; // change url
      result = await axios(pingURL); 

      if (result.status === 200) {
        this.status = ResourceHealth.Healthy; 
      } else {
        this.status = ResourceHealth.Unhealthy;
        this.details = `Received status: ${result.status}`;
      }
    } catch (e) {
      this.status = ResourceHealth.Unhealthy;
      this.details = e.message;
      // console.log(`HEALTH: ${this.name} is unhealthy.`, e.message);
    }
  }
}

export class DBServiceHealthCheck extends HealthIndicator  {
  constructor(
    public emit: (evt: AppEvent) => void,
    public bundleTable: BundleTable,
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
      this.emit({
        type: "service-healthy",
        data: {
          name: this.name,
          status: ResourceHealth.Healthy,
        },
      });
    } catch (e) {
      this.status = ResourceHealth.Unhealthy;
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

// check each service 
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
      results: this.checks
    };
  }
}

type HealthCheckResult = {
  status: ResourceHealth,
  results: HealthIndicator[]
};