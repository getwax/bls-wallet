import * as React from 'react';
import { ConnectionsSummary } from './ConnectionSummary';

export const ConnectionsWrapper: React.FunctionComponent = () => {
  return (
    <div className="">
      <div className="flex justify-between place-items-center">
        <div className="text-body">Connections</div>
      </div>

      <div className="flex flex-col gap-6 mt-8">
        <ConnectionsSummary onClick={() => {}} />
      </div>
    </div>
  );
};
