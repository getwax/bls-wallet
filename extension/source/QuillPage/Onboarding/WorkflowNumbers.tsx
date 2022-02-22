import { FunctionComponent } from 'react';

import Range from '../../helpers/Range';

const WorkflowNumbers: FunctionComponent<{
  current: number;
  max: number;
}> = ({ current, max }) => (
  <div className="flex justify-center space-x-10">
    {Range(max).map((i) => (
      <div
        key={i}
        className={`icon-lg rounded-full text-center leading-8 cursor-pointer ${
          i + 1 <= current ? 'bg-blue-500 text-white' : 'text-black'
        }`}
        onClick={() => onSelect(i)}
        onKeyDown={(e) => {
          if (['Space', 'Enter'].includes(e.code)) {
            onSelect(i + 1);
          }
        }}
      >
        {i + 1}
      </div>
    ))}
  </div>
);

function onSelect(pageIndex: number) {
  // Note: This is for demo purposes only. We're not going to be using
  // search parameters like this.
  window.location.href = `?p=${pageIndex + 1}`;
}

export default WorkflowNumbers;
