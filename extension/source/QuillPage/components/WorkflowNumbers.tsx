import * as React from 'react';

import Range from '../../helpers/Range';

const WorkflowNumbers: React.FunctionComponent<{
  current: number;
  max: number;
  onSelect?: (selection: number) => void;
}> = ({ current, max, onSelect = () => {} }) => (
  <div className="workflow-numbers quick-row">
    {Range(max).map((i) => (
      <>
        <div
          className={i + 1 <= current ? 'number highlight' : 'number'}
          onClick={() => onSelect(i + 1)}
          onKeyDown={(e) => {
            if (['Space', 'Enter'].includes(e.code)) {
              onSelect(i + 1);
            }
          }}
        >
          {i + 1}
        </div>
        {i + 1 === max &&  <div className="dash" />}
      </>
    ))}
  </div>
);

export default WorkflowNumbers;
