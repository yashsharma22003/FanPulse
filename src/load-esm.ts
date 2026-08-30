/** Runtime ESM import that TypeScript will not rewrite into `require()`. */
export function loadEsm<T>(specifier: string): Promise<T> {
  return new Function('s', 'return import(s)')(specifier) as Promise<T>;
}
