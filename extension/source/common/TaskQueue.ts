type Task = () => void;

export default class TaskQueue {
  #tasks: Task[] = [];

  push(task: Task): void {
    this.#tasks.push(task);
  }

  run(): void {
    while (true) {
      const task = this.#tasks.shift();

      if (task === undefined) {
        break;
      }

      try {
        task();
      } catch (error) {
        console.error('Uncaught exception in TaskQueue task', error);
      }
    }
  }
}
