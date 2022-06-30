import * as React from 'react';
import Blockies from 'react-blockies';

interface IContactsSummary {
  onClick: () => void;
  expanded?: boolean;
  name: string;
}

export const ContactsSummary: React.FunctionComponent<IContactsSummary> = ({
  onClick,
  expanded = false,
  name,
}) => {
  return (
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
            onClick={onClick}
          />
        </div>

        <div className="flex-grow flex place-items-center gap-4">
          <Blockies seed={name} className="rounded-md" size={5} scale={8} />
          <div>{name}</div>
        </div>
      </div>
    </div>
  );
};
