import * as React from 'react';
import measurePasswordStrength, {
  PasswordStrength,
} from '../../helpers/measurePasswordStrength';
import QuickRow from './QuickRow';

const passwordCommentaryMap: Record<PasswordStrength['descriptor'], string> = {
  'Very weak': 'Please consider using a stronger password.',
  Weak: 'Please consider using a stronger password.',
  Average:
    "This password is about average, which isn't great for protecting assets.",
  Good: 'This is a relatively good password, but could be more secure.',
  Strong: '',
};

const PasswordStrengthMeter: React.FunctionComponent<{ strength: number }> = ({
  strength,
}) => {
  const [color, setColor] = React.useState('bg-alert-500');

  const getColor = (level: number) => {
    if (level < 50) {
      return 'bg-alert-500';
    }
    if (level >= 50 && level < 75) {
      return 'bg-neutral-500';
    }
    return 'bg-positive-500';
  };

  React.useEffect(() => {
    setColor(getColor(strength));
  }, [strength]);

  return (
    <div className="mt-4 text-grey-500">
      Password strength
      <div
        className={`h-1 my-2 w-full rounded-md ${color}`}
        style={{ width: `${strength}%` }}
      />
    </div>
  );
};

const PasswordCreationForm: React.FunctionComponent<{
  onPasswordUpdate: (password: string | undefined) => void;
}> = ({ onPasswordUpdate }) => (
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

  <div className="password-creation-form quick-column">
    <div className="flex flex-col">
      <input type="password" placeholder="Password" className="input" onInput={(e) => {
            const newPassword = (e.target as HTMLInputElement).value;
            handleFieldsChange(newPassword, confirmPasswordFieldValue);
          }} />
      <input
        type="password"
        placeholder="Confirm password"
        className="input mt-2 disabled:input-filled"
        onInput={(e) => {
          const newConfirmPassword = (e.target as HTMLInputElement).value;
          handleFieldsChange(passwordFieldValue, newConfirmPassword);
        }}
      />
      <PasswordStrengthMeter strength={100} />
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
    </div>
  </div>
);

export default PasswordCreationForm;
