import { IClock } from "../helpers/Clock.ts";

export default class BatchTimer<T> {
  clearTimer: (() => void) | null = null;
  nextTriggerCompleteResolvers: ((promise: Promise<T>) => void)[] = [];

  constructor(
    public clock: IClock,
    public maxDelayMillis: number,
    public onTrigger: () => Promise<T>,
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

  clear() {
    this.clearTimer?.();
  }

  trigger() {
    this.clear();

    const resolvers = this.nextTriggerCompleteResolvers;
    this.nextTriggerCompleteResolvers = [];

    const promise = this.onTrigger();

    for (const resolve of resolvers) {
      resolve(promise);
    }
  }

  waitForNextCompletion() {
    return new Promise<T>((resolve) =>
      this.nextTriggerCompleteResolvers.push(resolve)
    );
  }
}
