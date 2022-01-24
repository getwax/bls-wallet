import { ArrowRight } from 'phosphor-react';
import * as React from 'react';

import Button from '../../components/Button';
import PasswordCreationForm from './PasswordCreationForm';

const PasswordCreationPanel: React.FunctionComponent = () => (
  <>
    <div className="instructions-text">
      <h3>Let&apos;s start by setting a password.</h3>
      <p>
        Occasionally we will ask you for this to prevent unwanted access of your
        wallets.
      </p>
    </div>
    <PasswordCreationForm />
    <div>
      <div style={{ display: 'inline-block' }}>
        <Button
          onPress={() => {}}
          className="btn-primary"
          icon={<ArrowRight className="icon-md" />} // TODO: Where is svg?
        >
          Continue
        </Button>
      </div>
    </div>
  </>
);

export default PasswordCreationPanel;
