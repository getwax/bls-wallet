import zxcvbn from 'zxcvbn';

export type PasswordStrength = {
  guessesLog10: number;
  descriptor: 'Very weak' | 'Weak' | 'Average' | 'Good' | 'Strong';
  fillRatio: number;
};

export default function measurePasswordStrength(
  password: string,
): PasswordStrength {
  const guessesLog10 = zxcvbn(password).guesses_log10;

  let descriptor: PasswordStrength['descriptor'];

  if (guessesLog10 < 3) {
    descriptor = 'Very weak';
  } else if (guessesLog10 < 6) {
    descriptor = 'Weak';
  } else if (guessesLog10 < 9) {
    descriptor = 'Average';
  } else if (guessesLog10 < 12) {
    descriptor = 'Good';
  } else {
    descriptor = 'Strong';
  }

  let fillRatio: number;

  if (guessesLog10 < 12) {
    fillRatio = guessesLog10 / 15;
  } else {
    fillRatio = 12 / 15 + approach(3 / 15, 1 / 15, guessesLog10 - 12);
  }

  return {
    guessesLog10,
    descriptor,
    fillRatio,
  };
}

/**
 * Very simple function that approaches 1 as x grows to infinity. Looks like
 * y = x close to the origin (slope = 1).
 */
function approach1(x: number) {
  return x / (x + 1);
}

/**
 * Builds upon approach1, specifying the target to approach and the initial
 * slope.
 */
function approach(target: number, initialSlope: number, x: number) {
  return target * approach1((x * initialSlope) / target);
}
