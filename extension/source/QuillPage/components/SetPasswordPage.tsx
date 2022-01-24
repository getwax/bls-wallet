import { ArrowRight } from 'phosphor-react';
import * as React from 'react';

import Button from '../../components/Button';
import PasswordCreationForm from './PasswordCreationForm';
import QuickColumn from './QuickColumn';
import QuickRow from './QuickRow';
import WorkflowNumbers from './WorkflowNumbers';

const SetPasswordPage: React.FunctionComponent = () => (
  <div className="set-password-page" style={{ height: '100vh' }}>
    <QuickRow>
      <QuickColumn>
        <div className="artwork" />
        <div className="info-text">
          <h3>What is Quill?</h3>
          <p>
            The world is changing and Quill will be your co-pilot as you engage
            with many new and exciting opportunities provided by the Ethereum
            blockchain.
          </p>
        </div>
        <div className="logo-footer" />
      </QuickColumn>
      <QuickColumn>
        <WorkflowNumbers current={1} max={3} />
        <div className="instructions-text">
          <h3>Let&apos;s start by setting a password.</h3>
          <p>
            Occasionally we will ask you for this to prevent unwanted access of
            your wallets.
          </p>
        </div>
        <PasswordCreationForm />
        <Button
          onPress={() => {}}
          highlight={true}
          icon={<ArrowRight className="icon-md" />}
        >
          Continue
        </Button>
      </QuickColumn>
    </QuickRow>
  </div>
);

export default SetPasswordPage;
