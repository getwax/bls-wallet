import * as React from 'react';

import Range from '../../helpers/Range';

const WorkflowNumbers: React.FunctionComponent<{
  current: number;
  max: number;
}> = ({ current, max }) => (
  <div className="workflow-numbers quick-row">
    {Range(max).map((i) => (
      <div className="quick-row" key={i}>
        <div
          className={i + 1 <= current ? 'number highlight' : 'number'}
          onClick={() => onSelect(i)}
          onKeyDown={(e) => {
            if (['Space', 'Enter'].includes(e.code)) {
              onSelect(i + 1);
            }
          }}
        >
          {i + 1}
        </div>
        {i + 1 !== max && <div className="dash">-</div>}
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
