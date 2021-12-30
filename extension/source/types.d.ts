declare module 'eth-query' {
  export default class EthQuery {
    constructor(provider: any);
    sendAsync(
      opts: { method: string; params?: unknown },
      cb: (err: Error, res: unknown) => void,
    ): void;
    request<T>(opts: { method: string; params?: unknown }): Promise<T>;
  }
}
