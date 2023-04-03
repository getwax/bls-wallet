export type ResourceHealth = 'healthy' | 'unhealthy';

type HealthCheckResult = {
  status: ResourceHealth,
};

export default class HealthService {
  public overallHealth: ResourceHealth = 'healthy';

  getHealth(): Promise<HealthCheckResult> {
    this.overallHealth = 'healthy';
          
    return Promise.resolve({
      status: this.overallHealth,
    });
  }
}