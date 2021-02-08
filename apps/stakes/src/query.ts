import index from 'just-index';

export function arrayToObject<T>(data: Array<T> | Record<string, T>) {
  return Array.isArray(data) ? index(data, 'id') : data;
}
