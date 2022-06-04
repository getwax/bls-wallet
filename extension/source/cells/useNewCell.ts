import { useMemo } from 'react';
import ICell from './ICell';
import MemoryCell from './MemoryCell';
import useCell from './useCell';

export default function useNewCell<T>(initialValue: T) {
  const cell: ICell<T> = useMemo(() => new MemoryCell(initialValue), []);
  const value = useCell(cell) ?? initialValue;

  return [value, cell] as const;
}
