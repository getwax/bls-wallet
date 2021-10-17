export type IClock = {
  now(): number;
  wait(millis: number): Promise<void>;
};

export default class Clock implements IClock {
  // Insist that users use the IClock type by preventing construction of Clock
  // and other values to appear to be a Clock by exposing the same interface.
  private constructor() {}
  #_nominalGuard = 0;

  static create(): IClock {
    return new Clock();
  }

  now() {
    return Date.now();
  }

  async wait(millis: number) {
    await new Promise((resolve) => setTimeout(resolve, millis));
  }
}
