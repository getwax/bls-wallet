import * as React from 'react';
import Blockies from 'react-blockies';
import onAction from '../../../helpers/onAction';

interface IContactsSummary {
  onAction: () => void;
  expanded?: boolean;
  name: string;
}

export const ContactsSummary: React.FunctionComponent<IContactsSummary> = ({
  onAction: onActionParam,
  expanded = false,
  name,
}) => (
  <div
    className={`p-4 rounded-lg ${
      expanded && 'bg-white border-2 border-blue-500 shadow-xl'
    }
    `}
  >
    <div className="flex place-items-center gap-4">
      <div className="w-5 h-5">
        <input
          type="radio"
          checked={expanded}
          readOnly
          className="h-5 w-5 cursor-pointer"
          {...onAction(onActionParam)}
        />
      </div>

      <div className="flex-grow flex place-items-center gap-4">
        <Blockies seed={name} className="rounded-md" size={5} scale={8} />
        <div>{name}</div>
      </div>
    </div>
  </div>
);
