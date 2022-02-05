export function timeout(duration: number): Promise<void> {
  return new Promise((resolve) => {
    const timeoutRef = window.setTimeout(() => {
      resolve();
      window.clearTimeout(timeoutRef);
    }, duration);
  });
}

export const createRandomId = (): string => Math.random().toString(36).slice(2);

export const getUserLanguage = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userLanguage =
    (window.navigator as any).userLanguage ||
    window.navigator.language ||
    'en-US';
  userLanguage = userLanguage.split('-');
  userLanguage = userLanguage[0] || 'en';
  return userLanguage;
};
