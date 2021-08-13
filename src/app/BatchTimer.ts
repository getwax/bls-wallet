import { IClock } from "../helpers/Clock.ts";
import nil from "../helpers/nil.ts";

type CompletedBatchListener = {
  resolve: () => void;
  completedBatchCount: number;
};

export default class BatchTimer {
  clearTimer: (() => void) | nil = nil;
  completedBatchListeners: CompletedBatchListener[] = [];
  completedBatchCount = 0;

  constructor(
    public clock: IClock,
    public maxDelayMillis: number,
    public runBatch: () => Promise<unknown>,
  ) {}

  notifyTxWaiting() {
    // If there isn't a timer to be cleared, create one
    if (!this.clearTimer) {
      let cleared = false;

      this.clearTimer = () => {
        cleared = true;
        this.clearTimer = nil;
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

  async trigger() {
    this.clear();

    await this.runBatch();
    this.completedBatchCount++;

    this.completedBatchListeners = this.completedBatchListeners.filter(
      (listener) => {
        if (listener.completedBatchCount <= this.completedBatchCount) {
          listener.resolve();
          return false;
        }

        return true;
      },
    );
  }

  async waitForCompletedBatches(completedBatchCount: number) {
    if (completedBatchCount <= this.completedBatchCount) {
      return;
    }

    await new Promise<void>((resolve) =>
      this.completedBatchListeners.push({
        resolve,
        completedBatchCount,
      })
    );
  }
}
