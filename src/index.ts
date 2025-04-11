export interface Config<K, T> {
  delay?: number;
  id: (key: K) => string;
  loader: (keys: K[]) => Promise<T[]>;
}

interface QueueItem<K, T> {
  key: K;
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

export class Batchloader<K, T> {
  constructor(private readonly config: Config<K, T>) {}
  private readonly queue = new Map<string, QueueItem<K, T>>();

  loadMany = (keys: K[]) => Promise.all(keys.map(this.load));

  load = (key: K) => {
    const id = this.config.id(key);
    const item = this.queue.get(id);
    if (item) return item.promise;
    const { promise, resolve, reject } = Promise.withResolvers<T>();
    this.queue.set(id, { key, promise, resolve, reject });
    if (this.queue.size === 1) {
      setTimeout(() => {
        const queue = [...this.queue.values()];
        this.queue.clear();
        this.config
          .loader(queue.map(({ key }) => key))
          .then(data => queue.forEach(({ resolve }, i) => resolve(data[i])))
          .catch(reason => queue.forEach(({ reject }) => reject(reason)));
      }, this.config.delay ?? 0);
    }
    return promise;
  };
}
