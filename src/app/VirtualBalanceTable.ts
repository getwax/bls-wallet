import { BigNumber } from "../../deps.ts";

import Mutex from "../helpers/Mutex.ts";

export default class VirtualBalanceTable {
  balances: Record<string, BigNumber | undefined> = {};
  mutexes: Record<string, Mutex | undefined> = {};

  constructor(
    public getInitialBalance: (
      owner: string,
      token: string,
    ) => Promise<BigNumber>,
  ) {}

  async tryWithdraw(
    owner: string,
    token: string,
    amount: BigNumber,
  ): Promise<boolean> {
    const mutex = this.#Mutex(owner, token);
    const lock = await mutex.Lock();

    try {
      let balance = await this.balanceOf(owner, token);

      balance = balance.sub(amount);

      if (balance.lt(0)) {
        return false;
      }

      this.balances[this.#Key(owner, token)] = balance;

      return true;
    } finally {
      lock.release();
    }
  }

  async balanceOf(owner: string, token: string): Promise<BigNumber> {
    const key = this.#Key(owner, token);
    let balance = this.balances[key];

    if (balance === undefined) {
      balance = await this.getInitialBalance(owner, token);
      this.balances[key] = balance;
    }

    return balance;
  }

  #Key(owner: string, token: string): string {
    return `${owner}:${token}`;
  }

  #Mutex(owner: string, token: string): Mutex {
    const key = this.#Key(owner, token);
    let mutex = this.mutexes[key];

    if (mutex === undefined) {
      mutex = new Mutex();
      this.mutexes[key] = mutex;
    }

    return mutex;
  }
}
