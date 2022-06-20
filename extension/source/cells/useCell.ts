import { useEffect, useState } from 'react';
import AsyncReturnType from '../types/AsyncReturnType';
import forEach from './forEach';

import { IReadableCell } from './ICell';

export default function useCell<C extends IReadableCell<unknown>>(
  cellParam: C,
) {
  type T = AsyncReturnType<C['read']>;
  const cell = cellParam as IReadableCell<T>;

  const [value, setValue] = useState<T>();

  useEffect(() => {
    const { stop } = forEach(cell, setValue);
    return stop;
  }, [cell]);

  return value;
}
