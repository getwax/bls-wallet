import { EventEmitter } from 'events';

import * as io from 'io-ts';
import { Versioned } from '../cells/CellCollection';

import CellIterator from '../cells/CellIterator';
import ICell, { CellEmitter } from '../cells/ICell';
import jsonHasChanged from '../cells/jsonHasChanged';
import assert from '../helpers/assert';
import { QuillInPageProvider } from '../PageContentScript/InPageProvider';
import ExplicitAny from '../types/ExplicitAny';

export default class QuillCellCollection {
  quill: QuillInPageProvider;
  cells: Record<string, QuillCell<ExplicitAny> | undefined> = {};

  constructor(quill?: QuillInPageProvider) {
    this.quill = quill ?? (window as any).ethereum;

    if (this.quill === undefined) {
      throw new Error('Missing provider');
    }
  }

  Cell<T>(
    key: string,
    type: io.Type<T>,
    defaultValue: T,
    hasChanged = jsonHasChanged,
  ): QuillCell<T> {
    let cell = this.cells[key];

    if (cell) {
      cell.applyType(type);
      return cell;
    }

    cell = new QuillCell(this.quill, key, type, defaultValue, hasChanged);

    this.cells[key] = cell;

    return cell;
  }

  async remove(key: string) {
    const cell = this.cells[key];
    cell?.end();

    await this.quill.request({
      method: 'quill_remove',
      params: [key],
    });
  }
}

export class QuillCell<T> implements ICell<T> {
  events = new EventEmitter() as CellEmitter<T>;
  ended = false;
  lastSeen?: Versioned<T>;
  lastProvided?: Versioned<T>;
  versionedType: io.Type<Versioned<T>>;

  constructor(
    public quill: QuillInPageProvider,
    public key: string,
    public type: io.Type<T>,
    public defaultValue: T,
    public hasChanged = jsonHasChanged,
  ) {
    this.versionedType = io.type({ version: io.number, value: type });

    (async () => {
      while (!this.ended) {
        const response = await this.quill.request({
          method: 'quill_read',
          params: [
            this.key,
            this.defaultValue,
            this.lastSeen && this.lastSeen.version + 1,
          ],
        });

        if (response === 'ended') {
          this.end();
          break;
        }

        assert(this.versionedType.is(response));
        this.lastSeen = response;

        if (this.hasChanged(this.lastProvided?.value, response.value)) {
          this.lastProvided = response;

          this.events.emit('change', {
            previous: this.lastProvided?.value,
            latest: response.value,
          });
        }
      }
    })();
  }

  end() {
    this.events.emit('end');
    this.ended = true;
  }

  async read(): Promise<T> {
    const response = await this.quill.request({
      method: 'quill_read',
      params: [this.key, this.defaultValue],
    });

    assert(this.versionedType.is(response));
    return response.value;
  }

  async write(newValue: T): Promise<void> {
    await this.quill.request({
      method: 'quill_write',
      params: [this.key, newValue],
    });
  }

  [Symbol.asyncIterator](): CellIterator<T> {
    return new CellIterator<T>(this);
  }

  applyType<X>(type: io.Type<X>) {
    if (type === io.unknown) {
      return;
    }

    if (this.type !== io.unknown && this.type.name !== type.name) {
      throw new Error(
        [
          'Tried to get existing storage cell with a different type',
          `(type: ${type.name}, existing: ${this.type.name})`,
        ].join(' '),
      );
    }

    if (this.lastSeen && !type.is(this.lastSeen.value)) {
      throw new Error(
        [
          `Type mismatch at storage key ${this.key}`,
          `contents: ${JSON.stringify(this.lastSeen.value)}`,
          `expected: ${type.name}`,
        ].join(' '),
      );
    }

    if (this.type === io.unknown) {
      this.type = type as unknown as io.Type<T>;
      this.versionedType = io.type({ version: io.number, value: this.type });
    }
  }
}
