/* eslint-disable @typescript-eslint/naming-convention */

import * as io from 'io-ts';
import { ethers } from 'ethers';

import { IReadableCell } from '../cells/ICell';
import { FormulaCell } from '../cells/FormulaCell';
import approximate from '../cells/approximate';
import RandomId from '../helpers/RandomId';
import assertType from '../cells/assertType';
import assert from '../helpers/assert';
import QuillCells from '../QuillCells';
import toOkError from '../helpers/toOkError';

const Object_ = io.record(io.string, io.unknown);
type Object_ = io.TypeOf<typeof Object_>;

const RpcMessage = io.type({
  method: io.string,
  params: io.array(io.unknown),
  id: io.string,
});

type RpcMessage = io.TypeOf<typeof RpcMessage>;

export default class NetworkController
  implements ethers.providers.ExternalProvider
{
  // TODO: MEGAFIX: Move / deduplicate these cells
  blockNumber: IReadableCell<number>;

  constructor(
    public network: QuillCells['network'],
    time: IReadableCell<number>,
  ) {
    this.blockNumber = new FormulaCell(
      {
        network,

        // TODO: MEGAFIX: Once we stop actively tracking blocks we should
        // increase the frequency here. ethers polls every 4 seconds, that seems
        // reasonable.
        time: approximate(time, 20_000),
      },
      () => this.fetchBlockNumber(),
    );
  }

  async requestStrict(body: RpcMessage) {
    const { rpcTarget } = await this.network.read();

    const res = await fetch(rpcTarget, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      body: JSON.stringify({
        method: body.method,
        jsonrpc: '2.0',
        id: body.id,
        params: body.params,
      }),
    });

    const json = await toOkError(() => res.json());
    assert('ok' in json);

    return json.ok.result;
  }

  async request(body: unknown) {
    assertType(body, Object_);
    body.id ??= RandomId();
    assertType(body, RpcMessage);
    return await this.requestStrict(body);
  }

  private async fetchBlockNumber() {
    const res = await this.requestStrict({
      method: 'eth_blockNumber',
      id: RandomId(),
      params: [],
    });
    assertType(res, io.string);
    const resNumber = Number(res);
    assert(Number.isFinite(resNumber));
    return resNumber;
  }
}
