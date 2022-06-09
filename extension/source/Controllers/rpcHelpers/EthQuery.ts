import EthQuery from 'eth-query';

EthQuery.prototype.request = function request<T>(opts: {
  method: string;
  params?: unknown;
}): Promise<T> {
  return new Promise((resolve, reject) => {
    this.sendAsync(opts, (error: Error, result: unknown) => {
      if (error) return reject(error);
      resolve(result as T);
    });
  });
};

export default EthQuery;
