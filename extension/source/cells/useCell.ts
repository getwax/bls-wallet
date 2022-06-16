import { useEffect, useState } from 'react';
import AsyncReturnType from '../types/AsyncReturnType';

import { IReadableCell } from './ICell';
import Stoppable from './Stoppable';

export default function useCell<C extends IReadableCell<unknown>>(
  cellParam: C,
) {
  type T = AsyncReturnType<C['read']>;
  const cell = cellParam as IReadableCell<T>;

  const [value, setValue] = useState<T>();

  useEffect(() => {
    const stoppableSequence = new Stoppable(cell);

    (async () => {
      for await (const v of stoppableSequence) {
        setValue(v);
      }
    })();

    return () => {
      stoppableSequence.stop();
    };
  }, [cell]);

  return value;
}
