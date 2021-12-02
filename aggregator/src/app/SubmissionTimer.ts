import { IClock } from "../helpers/Clock.ts";
import nil from "../helpers/nil.ts";

type CompletedSubmissionListener = {
  resolve: () => void;
  completedSubmissionCount: number;
};

export default class SubmissionTimer {
  clearTimer: (() => void) | nil = nil;
  completedSubmissionListeners: CompletedSubmissionListener[] = [];
  completedSubmissionCount = 0;

  constructor(
    public clock: IClock,
    public maxDelayMillis: number,
    public runSubmission: () => Promise<unknown>,
  ) {}

  notifyActive() {
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

    await this.runSubmission();
    this.completedSubmissionCount++;

    this.completedSubmissionListeners = this.completedSubmissionListeners
      .filter(
        (listener) => {
          if (
            listener.completedSubmissionCount <= this.completedSubmissionCount
          ) {
            listener.resolve();
            return false;
          }

          return true;
        },
      );
  }

  async waitForCompletedSubmissions(completedSubmissionCount: number) {
    if (completedSubmissionCount <= this.completedSubmissionCount) {
      return;
    }

    await new Promise<void>((resolve) =>
      this.completedSubmissionListeners.push({
        resolve,
        completedSubmissionCount,
      })
    );
  }
}
