import * as React from 'react';

import Range from '../../helpers/Range';

const WorkflowNumbers: React.FunctionComponent<{
  current: number;
  max: number;
}> = ({ current, max }) => (
  <div className="workflow-numbers quick-row">
    {Range(max).map((i) => (
      <>
        <div className={i + 1 <= current ? 'number highlight' : 'number'}>
          {i + 1}
        </div>
        {i + 1 === max ? <></> : <div className="dash" />}
      </>
    ))}
  </div>
);

export default WorkflowNumbers;
