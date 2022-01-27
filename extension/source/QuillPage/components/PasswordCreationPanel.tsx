import { ArrowRight } from 'phosphor-react';
import * as React from 'react';

import Button from '../../components/Button';
import PasswordCreationForm from './PasswordCreationForm';

const PasswordCreationPanel: React.FunctionComponent<{
  onComplete: () => void;
}> = ({ onComplete }) => (
  const [password, setPassword] = React.useState<string>();

  return(
    <>
    <div className="mb-10">
      <div className="font-bold">Let&apos;s start by setting a password.</div>
      <span>
        Occasionally we will ask you for this to prevent unwanted access of your
        wallets.
      </span>
    </div>
    <div className="h-32 ">
      <PasswordCreationForm onPasswordUpdate={setPassword}/>
    </div>
    <div className="py-24 float-right">
      <Button
        className={`w-32 ${password === undefined ? 'btn-disabled' : 'btn-primary'}`}
        onPress={() => password && onComplete()}
        icon={<ArrowRight className="icon-md" />}
      >
        Continue
      </Button>
    </div>
  </>
  )
);

export default PasswordCreationPanel;
