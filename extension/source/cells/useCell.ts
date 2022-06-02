import { useEffect, useState } from 'react';

import ICell, { ChangeEvent } from './ICell';

export default function useCell<T>(cell: ICell<T>) {
  const [value, setValue] = useState<T>();

  useEffect(() => {
    const changeHandler = ({ latest }: ChangeEvent<T>) => {
      setValue(latest);
    };

    cell.events.on('change', changeHandler);
    return () => {
      cell.events.off('change', changeHandler);
    };
  }, [cell]);

  return [value, (newValue: T) => cell.write(newValue)];
}
