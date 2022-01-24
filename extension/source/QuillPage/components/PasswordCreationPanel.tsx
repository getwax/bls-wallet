import { ArrowRight } from "phosphor-react";
import * as React from "react";

import Button from "../../components/Button";
import PasswordCreationForm from "./PasswordCreationForm";

const PasswordCreationPanel: React.FunctionComponent<{
  onComplete: () => void;
}> = ({ onComplete }) => (
  <>
    <div className="mb-10">
      <div className="font-bold">Let&apos;s start by setting a password.</div>
      <span>
        Occasionally we will ask you for this to prevent unwanted access of your
        wallets.
      </span>
    </div>
    <div className="h-32 ">
      <PasswordCreationForm />
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
