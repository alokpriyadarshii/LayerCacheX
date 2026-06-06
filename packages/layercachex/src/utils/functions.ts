export async function asyncNoop() {}

export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  let result: ReturnType<T>

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!called) {
      called = true
      result = fn.apply(this, args)
    }

    return result
  } as T
}

export async function tryAsync<T>(fn: () => Promise<T>): Promise<[T | undefined, Error | null]> {
  try {
    return [await fn(), null]
  } catch (error) {
    return [undefined, error instanceof Error ? error : new Error(String(error))]
  }
}
