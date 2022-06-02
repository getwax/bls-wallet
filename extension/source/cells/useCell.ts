import { useEffect, useState } from 'react';
import AsyncReturnType from '../types/AsyncReturnType';

import ICell from './ICell';

export default function useCell<C extends ICell<unknown>>(cellParam: C) {
  type T = AsyncReturnType<C['read']>;
  const cell = cellParam as ICell<T>;

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

  return [value, (newValue: T) => cell.write(newValue)] as const;
}
