class Lock {
  release: () => void;

  constructor(release: (lock: Lock) => void) {
    this.release = () => release(this);
  }
}

export default class Mutex {
  #queue: ((lock: Lock) => void)[] = [];
  #currentLock: Lock | null = null;

  tryLock(): Lock | null {
    if (this.#currentLock === null) {
      this.#currentLock = new Lock((lock) => this.#release(lock));
      return this.#currentLock;
    }

    return null;
  }

  Lock(): Promise<Lock> {
    const lock = this.tryLock();

    if (lock) {
      return Promise.resolve(lock);
    }

    return new Promise<Lock>((resolve) => this.#queue.push(resolve));
  }

  isLocked() {
    return this.#currentLock !== null;
  }

  #release(lock: Lock) {
    if (lock !== this.#currentLock) {
      throw new Error("invalid release");
    }

    this.#currentLock = null;

    const resolveNext = this.#queue.shift();

    if (resolveNext) {
      resolveNext(this.tryLock()!);
    }
  }

  isCurrentLock(lock: Lock) {
    return lock === this.#currentLock;
  }
}
