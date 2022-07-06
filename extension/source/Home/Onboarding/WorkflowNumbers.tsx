import { FunctionComponent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import onAction from '../../helpers/onAction';

import Range from '../../helpers/Range';

const WorkflowNumbers: FunctionComponent<{
  max: number;
}> = ({ max }) => {
  const [params, setParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // TODO (merge-ok) Use hash, deduplicate page detection with other components
    const p = params.get('p');

    if (p !== null) {
      setCurrentPage(Number(p));
    }
  }, [params]);

  function onSelect(index: number) {
    // Note: This is for demo purposes only. We're not going to be using
    // search parameters like this.
    setParams({ p: (index + 1).toString() });
  }

  return (
    <div className="flex justify-center space-x-10">
      {Range(max).map((i) => (
        <div
          key={i}
          className={`icon-lg rounded-full text-center leading-8 cursor-pointer ${
            i + 1 <= currentPage ? 'bg-blue-500 text-white' : 'text-black'
          }`}
          {...onAction(() => onSelect(i))}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
};

export default WorkflowNumbers;
