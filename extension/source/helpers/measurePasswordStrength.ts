import zxcvbn from 'zxcvbn';

export default function measurePasswordStrength(password: string): number {
  return zxcvbn(password).guesses_log10;
}
