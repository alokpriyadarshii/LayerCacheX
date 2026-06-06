export function sleep(duration: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, duration))
}

export function hybridReturn<T extends object, U extends readonly unknown[]>(object: T, tuple: U) {
  return Object.assign(object, {
    [Symbol.iterator]: function* () {
      yield* tuple
    },
  }) as T & U
}
