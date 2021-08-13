import nil from "./nil.ts";

class Lock {
  release: () => void;

  constructor(release: (lock: Lock) => void) {
    this.release = () => release(this);
  }
}

export default class Mutex {
  #queue: ((lock: Lock) => void)[] = [];
  #currentLock: Lock | nil = nil;

  tryLock(): Lock | nil {
    if (this.#currentLock === nil) {
      this.#currentLock = new Lock((lock) => this.#release(lock));
      return this.#currentLock;
    }

    return nil;
  }

  Lock(): Promise<Lock> {
    const lock = this.tryLock();

    if (lock) {
      return Promise.resolve(lock);
    }

    return new Promise<Lock>((resolve) => this.#queue.push(resolve));
  }

  isLocked() {
    return this.#currentLock !== nil;
  }

  #release(lock: Lock) {
    if (lock !== this.#currentLock) {
      throw new Error("invalid release");
    }

    this.#currentLock = nil;

    const resolveNext = this.#queue.shift();

    if (resolveNext) {
      resolveNext(this.tryLock()!);
    }
  }

  isCurrentLock(lock: Lock) {
    return lock === this.#currentLock;
  }
}
