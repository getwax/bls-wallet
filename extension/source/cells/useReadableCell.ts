import { useEffect, useState } from 'react';

import { ChangeEvent, IReadableCell } from './ICell';

export default function useReadableCell<T>(cell: IReadableCell<T>) {
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

  return value;
}
