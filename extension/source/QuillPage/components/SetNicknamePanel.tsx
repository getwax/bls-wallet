import { ArrowRight, Info } from "phosphor-react";
import * as React from "react";

import Button from "../../components/Button";

const PasswordCreationPanel: React.FunctionComponent<{
  onComplete: () => void;
}> = ({ onComplete }) => (
  <>
    <div className="mb-10">
      <div className="font-bold">
        It&apos;s time to create your first wallet!
      </div>
      <span>
        Let&apos;s give it a nickname so that you can easily identify it when
        you have more wallets.
      </span>
    </div>
    <div className="h-32 ">
      <input type="text" placeholder="Nickname" className="input" />
      <div className="bg-grey-200 p-4 mt-4 text-[10pt] rounded-md flex gap-4">
        <Info className="icon-md text-blue-500 mt-1" />
        <div className="align-text-top">
          Setting a nickname is optional but recommended.
        </div>
      </div>
    </div>
    <div className="py-24 float-right">
      <Button
        onPress={onComplete}
        className="btn-primary w-32"
        icon={<ArrowRight className="icon-md" />} // TODO: Where is svg?
      >
        Continue
      </Button>
    </div>
  </>
);

export default PasswordCreationPanel;
