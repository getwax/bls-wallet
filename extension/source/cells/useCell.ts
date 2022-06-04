import { useEffect, useState } from 'react';
import AsyncReturnType from '../types/AsyncReturnType';

import { IReadableCell } from './ICell';

export default function useCell<C extends IReadableCell<unknown>>(cellParam: C) {
  type T = AsyncReturnType<C['read']>;
  const cell = cellParam as IReadableCell<T>;

  const [value, setValue] = useState<T>();

  useEffect(() => {
    let ended = false;

    (async () => {
      for await (const v of cell) {
        if (ended) {
          break;
        }

        setValue(v);
      }
    })();

    return () => {
      ended = true;
    };
  }, [cell]);

  return value;
}
