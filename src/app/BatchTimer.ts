import { IClock } from "../helpers/Clock.ts";

export default class BatchTimer {
  clearTimer: (() => void) | null = null;

  constructor(
    public clock: IClock,
    public maxDelayMillis: number,
    public onTrigger: () => void,
  ) {}

  notifyTxWaiting() {
    // If there isn't a timer to be cleared, create one
    if (!this.clearTimer) {
      let cleared = false;

      this.clearTimer = () => {
        cleared = true;
        this.clearTimer = null;
      };

      this.clock.wait(this.maxDelayMillis)
        .then(() => {
          if (!cleared) {
            this.trigger();
          }
        });
    }
  }

  trigger() {
    if (this.clearTimer) {
      this.clearTimer();
    }

    this.onTrigger();
  }
}
