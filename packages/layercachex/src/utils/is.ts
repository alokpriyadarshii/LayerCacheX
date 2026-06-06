export const is = {
  number(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value)
  },

  function(value: unknown): value is (...args: any[]) => any {
    return typeof value === 'function'
  },

  undefined(value: unknown): value is undefined {
    return value === undefined
  },
}
