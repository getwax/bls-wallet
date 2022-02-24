import { Writable as WritableStream, WritableOptions } from 'readable-stream';

export default class ControllerStreamSink extends WritableStream {
  _asyncWriteFn: (chunk: unknown, encoding: string) => Promise<unknown>;
  constructor(
    asyncWriteFn: (chunk: unknown, encoding: string) => Promise<unknown>,
    _opts?: Partial<WritableOptions>,
  ) {
    const opts = { objectMode: true, ...(_opts || {}) };
    super(opts);
    this._asyncWriteFn = asyncWriteFn;
  }

  // write from incoming stream to state
  _write(
    chunk: unknown,
    encoding: string,
    callback: (error?: Error | null, res?: unknown) => void,
  ) {
    this._asyncWriteFn(chunk, encoding)
      .then((res) => callback(null, res))
      .catch((err) => callback(err));
  }
}
