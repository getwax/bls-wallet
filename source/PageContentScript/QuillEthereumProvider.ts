import TransportClient from '../common/TransportClient';
import RpcMap from '../common/RpcMap';

type RpcRequest<M extends keyof RpcMap> = {
  method: M;
  params: RpcMap[M]['params'];
};

export default class QuillEthereumProvider {
  #transportClient: TransportClient;

  constructor(transportClient: TransportClient) {
    this.#transportClient = transportClient;
  }

  async request<R extends RpcRequest<keyof RpcMap>>(
    req: R,
  ): Promise<RpcMap[R['method']]['result']> {
    const result = await this.#transportClient(req);

    return result as RpcMap[R['method']]['result'];
  }
}
