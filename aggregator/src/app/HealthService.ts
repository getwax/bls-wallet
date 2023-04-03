export type ResourceHealth = 'healthy' | 'unhealthy';

type HealthCheckResult = {
  status: ResourceHealth,
};

export default class HealthService {
  getHealth(): Promise<HealthCheckResult> {
    return Promise.resolve({ status: 'healthy' });
  }
}