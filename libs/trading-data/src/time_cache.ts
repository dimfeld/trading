interface TimedData<T> {
  time: Date;
  data: T;
}

export interface TimeCache<T> {
  set(key: string, data: T): void;
  get(key: string): T | null;
  delete(key: string): void;
}

export function timeCache<T = any>(timeLimitMs: number) {
  let cache = new Map<string, TimedData<T>>();
  return {
    set(key: string, data: T) {
      cache.set(key, { time: new Date(), data });
    },
    get(key: string) {
      let data = cache.get(key);
      if (!data || Date.now() - data.time.valueOf() > timeLimitMs) {
        return null;
      }

      return data.data;
    },
    delete(key: string) {
      cache.delete(key);
    },
  };
}
