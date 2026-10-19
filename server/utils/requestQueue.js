/**
 * Serial request queue with a minimum gap between starts.
 *
 * Codeforces rejects clients that send more than ~1 request every 2 seconds,
 * so every Codeforces call goes through a shared queue instance. Tasks run one
 * at a time, in FIFO order, and never start closer together than
 * `minIntervalMs`.
 */
export class RequestQueue {
  constructor({ minIntervalMs = 0, name = 'queue' } = {}) {
    this.minIntervalMs = minIntervalMs;
    this.name = name;
    this.queue = [];
    this.running = false;
    this.lastStartedAt = 0;
  }

  get pending() {
    return this.queue.length;
  }

  /**
   * @template T
   * @param {() => Promise<T>} task
   * @returns {Promise<T>}
   */
  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.#drain();
    });
  }

  async #drain() {
    if (this.running) return;
    this.running = true;

    try {
      while (this.queue.length > 0) {
        const { task, resolve, reject } = this.queue.shift();

        const waitFor = this.minIntervalMs - (Date.now() - this.lastStartedAt);
        if (waitFor > 0) await sleep(waitFor);

        this.lastStartedAt = Date.now();

        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}

export const sleep = (ms) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });

export default RequestQueue;
