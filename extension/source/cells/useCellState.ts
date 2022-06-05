import { useMemo } from 'react';
import ICell from './ICell';
import MemoryCell from './MemoryCell';
import useCell from './useCell';

declare function useCellStateOverload<T>(
  initialValue: T,
): [T, (newValue: T) => void, ICell<T>];

declare function useCellStateOverload<T>(): /* no argument given */
[T | undefined, (newValue: T | undefined) => void, ICell<T | undefined>];

function useCellState<T>(
  initialValue: T,
): [T, (newValue: T) => void, ICell<T>] {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cell = useMemo(() => new MemoryCell(initialValue), []);
  const cellValue = useCell(cell);

  return [cellValue ?? initialValue, (newValue) => cell.write(newValue), cell];
}

export default useCellState as typeof useCellStateOverload;
