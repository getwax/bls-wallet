export function timeout(duration: number): Promise<void> {
  return new Promise((resolve) => {
    const timeoutRef = window.setTimeout(() => {
      resolve();
      window.clearTimeout(timeoutRef);
    }, duration);
  });
}

export const createRandomId = (): string => Math.random().toString(36).slice(2);
