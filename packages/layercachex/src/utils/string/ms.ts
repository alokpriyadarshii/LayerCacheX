const UNITS: Record<string, number> = {
  ms: 1,
  millisecond: 1,
  milliseconds: 1,
  s: 1000,
  sec: 1000,
  second: 1000,
  seconds: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  h: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
}

export const ms = {
  parse(value: string) {
    const match = /^(-?(?:\d+)?\.?\d+)\s*([a-z]+)$/i.exec(value.trim())
    if (!match) throw new Error(`Invalid duration: ${value}`)

    const amount = Number(match[1])
    const unit = UNITS[match[2].toLowerCase()]
    if (!unit) throw new Error(`Invalid duration unit: ${match[2]}`)

    return amount * unit
  },
}
