import { Duplex as DuplexStream, _IWritable } from 'readable-stream';

import BaseController from '../BaseController';
import { BaseConfig, BaseState } from '../interfaces';

export default class ControllerStoreStream<
  C extends BaseConfig,
  S extends BaseState,
> extends DuplexStream {
  handler: (state: S) => void;

  controller: BaseController<C, S>;

  constructor(controller: BaseController<C, S>) {
    super({
      // pass values, not serializations
      objectMode: true,
    });
    // dont buffer outgoing updates
    this.resume();
    // save handler so we can unsubscribe later
    this.handler = (state: S) => this.push(state);
    // subscribe to obsStore changes
    this.controller = controller;
    this.controller.on('store', this.handler);
  }

  // emit current state on new destination
  pipe<U extends _IWritable>(dest: U, options?: { end?: boolean }): U {
    const result = super.pipe(dest, options);
    dest.write(this.controller.state as any);
    return result;
  }

  // write from incoming stream to state
  _write(
    chunk: any,
    _encoding: string,
    callback: (error?: Error | null) => void,
  ): void {
    this.controller.update(chunk);
    callback();
  }

  // noop - outgoing stream is asking us if we have data we aren't giving it
  _read(_size: number): void {
    return undefined;
  }

  // unsubscribe from event emitter
  _destroy(err: Error | null, callback: (error: Error | null) => void): void {
    this.controller.removeListener('store', this.handler);
    super._destroy(err, callback);
  }
}
