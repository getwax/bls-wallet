import * as React from 'react';

interface ISettingsSummary {
  expanded?: boolean;
  name: string;
}

export const SettingsSummary: React.FunctionComponent<ISettingsSummary> = ({
  expanded = false,
  name,
}) => {
  return (
    <div
      className={`p-4 rounded-lg bg-white border ${
        expanded && 'bg-white border-2 border-blue-500 shadow-shadow-xl'
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
          />
        </div>

        <div className="flex-grow flex place-items-center gap-4">
          <div>{name}</div>
        </div>
      </div>
    </div>
  );
};
