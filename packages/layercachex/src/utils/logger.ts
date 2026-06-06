export type LogObject = Record<string, any>

export type Logger = {
  child(obj: LogObject): Logger
  trace(messageOrObject: any, messageOrObject2?: any): void
  debug(messageOrObject: any, messageOrObject2?: any): void
  warn(messageOrObject: any, messageOrObject2?: any): void
  error(messageOrObject: any, messageOrObject2?: any): void
  fatal(messageOrObject: any, messageOrObject2?: any): void
  info(messageOrObject: any, messageOrObject2?: any): void
}

export type TestLog = {
  level: 'trace' | 'debug' | 'warn' | 'error' | 'fatal' | 'info'
  msg?: string
  obj?: any
}

export type TestLogger = Logger & {
  logs: TestLog[]
}

function createNoopLogger(): Logger {
  const logger: Logger = {
    child: () => logger,
    trace: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    info: () => {},
  }

  return logger
}

export function noopLogger() {
  return createNoopLogger()
}

export function testLogger(): TestLogger {
  const logs: TestLog[] = []
  const write = (level: TestLog['level']) => (messageOrObject: any, messageOrObject2?: any) => {
    logs.push({
      level,
      msg: typeof messageOrObject2 === 'string' ? messageOrObject2 : messageOrObject,
      obj: typeof messageOrObject === 'object' ? messageOrObject : undefined,
    })
  }

  const logger: TestLogger = {
    logs,
    child: () => logger,
    trace: write('trace'),
    debug: write('debug'),
    warn: write('warn'),
    error: write('error'),
    fatal: write('fatal'),
    info: write('info'),
  }

  return logger
}
