import * as React from 'react';
import QuickColumn from './QuickColumn';
import QuickRow from './QuickRow';

const PasswordCreationForm: React.FunctionComponent = () => (
  <div className="password-creation-form quick-column">
    <QuickColumn>
      <input
        type="password"
        placeholder="Password"
        style={{ width: '100%', flexGrow: 0 }}
      />
      <input
        type="password"
        placeholder="Confirm password"
        style={{ width: '100%', flexGrow: 0 }}
      />
      <QuickRow>
        <div>Password strength</div>
        <div>Average</div>
      </QuickRow>
      <div>This password is ok, but could be more secure.</div>
    </QuickColumn>
  </div>
);

export default PasswordCreationForm;
