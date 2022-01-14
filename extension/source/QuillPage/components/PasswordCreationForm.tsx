import * as React from 'react';

import measurePasswordStrength, {
  PasswordStrength,
} from '../../helpers/measurePasswordStrength';
import QuickColumn from './QuickColumn';
import QuickRow from './QuickRow';

const passwordCommentaryMap: Record<PasswordStrength['descriptor'], string> = {
  'Very weak': 'Please consider using a stronger password.',
  Weak: 'Please consider using a stronger password.',
  Average:
    "This password is about average, which isn't great for protecting assets.",
  Good: 'This is a relatively good password, but could be more secure.',
  Strong: '',
};

const PasswordCreationForm: React.FunctionComponent<{
  onPasswordUpdate: (password: string | undefined) => void;
}> = ({ onPasswordUpdate }) => {
  const [password, setPassword] = React.useState<string>();

  const [passwordFieldValue, setPasswordFieldValue] = React.useState('');
  const [confirmPasswordFieldValue, setConfirmPasswordFieldValue] =
    React.useState('');

  function handleFieldsChange(newPassword: string, newConfirmPassword: string) {
    if (newPassword !== passwordFieldValue) {
      setPasswordFieldValue(newPassword);
    }

    if (newConfirmPassword !== confirmPasswordFieldValue) {
      setConfirmPasswordFieldValue(newConfirmPassword);
    }

    const newResultPassword =
      newPassword === newConfirmPassword ? newPassword : undefined;

    if (newResultPassword !== password) {
      setPassword(newResultPassword);
      onPasswordUpdate(newResultPassword);
    }
  }

  const passwordStrength = measurePasswordStrength(passwordFieldValue);

  const confirmFieldClasses = ['password-confirm-field'];

  if (confirmPasswordFieldValue === '') {
    confirmFieldClasses.push('empty');
  } else if (confirmPasswordFieldValue === passwordFieldValue) {
    confirmFieldClasses.push('correct');
  } else if (passwordFieldValue.startsWith(confirmPasswordFieldValue)) {
    confirmFieldClasses.push('incomplete');
  } else {
    confirmFieldClasses.push('incorrect');
  }

  return (
    <div
      className={[
        'password-creation-form',
        'quick-column',
        passwordStrength.descriptor.toLowerCase().replace(' ', '-'),
      ].join(' ')}
    >
      <QuickColumn>
        <input
          type="password"
          placeholder="Password"
          style={{ width: '100%', flexGrow: 0 }}
          onInput={(e) => {
            const newPassword = (e.target as HTMLInputElement).value;
            handleFieldsChange(newPassword, confirmPasswordFieldValue);
          }}
        />
        <input
          type="password"
          placeholder="Confirm password"
          className={confirmFieldClasses.join(' ')}
          style={{ width: '100%', flexGrow: 0 }}
          onInput={(e) => {
            const newConfirmPassword = (e.target as HTMLInputElement).value;
            handleFieldsChange(passwordFieldValue, newConfirmPassword);
          }}
        />
        <QuickRow>
          <div>Password strength</div>
          <div>{passwordStrength.descriptor}</div>
        </QuickRow>
        <div>
          <div
            className="password-meter"
            style={{
              width: `${passwordStrength.fillRatio * 100}%`,
            }}
          >
            &nbsp;
          </div>
          <div>
            Fill width: {(passwordStrength.fillRatio * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          {passwordFieldValue &&
            passwordCommentaryMap[passwordStrength.descriptor]}
        </div>
      </QuickColumn>
    </div>
  );
};

export default PasswordCreationForm;
