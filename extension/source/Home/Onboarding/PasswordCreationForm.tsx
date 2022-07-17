import { Info } from 'phosphor-react';
import { FunctionComponent, useState, useEffect, ChangeEvent } from 'react';
import measurePasswordStrength, {
  PasswordStrength,
} from '../../helpers/measurePasswordStrength';

const passwordCommentaryMap: Record<PasswordStrength['descriptor'], string> = {
  'Very weak': 'Please consider using a stronger password.',
  Weak: 'Please consider using a stronger password.',
  Average:
    "This password is about average, which isn't great for protecting assets.",
  Good: 'This is a relatively good password, but could be more secure.',
  Strong: 'Looks like a good password!',
};

const PasswordStrengthMeter: FunctionComponent<{
  strength: PasswordStrength;
}> = ({ strength }) => {
  const [color, setColor] = useState('bg-alert-500');

  const getColor = (level: number) => {
    if (level < 6) {
      return 'bg-alert-500';
    }
    if (level < 9) {
      return 'bg-neutral-400';
    }
    if (level < 12) {
      return 'bg-neutral-500';
    }
    return 'bg-positive-500';
  };

  useEffect(() => {
    setColor(getColor(strength.guessesLog10));
  }, [strength]);

  if (strength.fillRatio !== 0) {
    return (
      <div className="mt-4 text-grey-500">
        Password strength
        <div
          className={`h-1 my-2 w-full transition-all rounded-md ${color}`}
          style={{ width: `${strength.fillRatio * 100}%` }}
        />
        <div className="bg-grey-200 p-4 mt-4 text-[10pt] rounded-md flex gap-4">
          <Info className="icon-md text-blue-500 mt-1" />
          <div className="align-text-top">
            {passwordCommentaryMap[strength.descriptor]}
          </div>
        </div>
      </div>
    );
  }
  return <></>;
};

const PasswordCreationForm: FunctionComponent<{
  onPasswordUpdate: (password: string | undefined) => void;
}> = ({ onPasswordUpdate }) => {
  const [password, setPassword] = useState<string>();

  const [passwordFieldValue, setPasswordFieldValue] = useState('');
  const [confirmPasswordFieldValue, setConfirmPasswordFieldValue] =
    useState('');

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

  const getConfirmPasswordClass = () => {
    if (confirmPasswordFieldValue === '') {
      return '';
    }
    if (confirmPasswordFieldValue === passwordFieldValue) {
      return [
        'border-2 border-positive-500 bg-positive-500',
        'focus:border-positive-500',
      ].join(' ');
    }
    if (passwordFieldValue.startsWith(confirmPasswordFieldValue)) {
      return [
        'border-2 border-neutral-500 bg-neutral-500',
        'focus:border-neutral-500',
      ].join(' ');
    }
    return 'border-2 border-alert-500 bg-alert-500 focus:border-alert-500';
  };

  return (
    <div>
      <div className="flex flex-col">
        <input
          type="password"
          placeholder="Password"
          onInput={(e: ChangeEvent<HTMLInputElement>) => {
            const newPassword = e.target.value;
            handleFieldsChange(newPassword, confirmPasswordFieldValue);
          }}
        />
        <input
          type="password"
          placeholder="Confirm password"
          className={[
            'mt-2 bg-opacity-5 border-opacity-25 focus:border-opacity-25',
            getConfirmPasswordClass(),
          ].join(' ')}
          disabled={!passwordFieldValue}
          onInput={(e: ChangeEvent<HTMLInputElement>) => {
            const newConfirmPassword = e.target.value;
            handleFieldsChange(passwordFieldValue, newConfirmPassword);
          }}
        />
        <PasswordStrengthMeter strength={passwordStrength} />
      </div>
    </div>
  );
};

export default PasswordCreationForm;
