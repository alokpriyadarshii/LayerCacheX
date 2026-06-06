const UNITS: Record<string, number> = {
  b: 1,
  byte: 1,
  bytes: 1,
  kb: 1024,
  kib: 1024,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  gb: 1024 ** 3,
  gib: 1024 ** 3,
}

export const bytes = {
  parse(value: string | number) {
    if (typeof value === 'number') return value

    const match = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/i.exec(value.trim())
    if (!match) throw new Error(`Invalid byte size: ${value}`)

    const amount = Number(match[1])
    const unit = UNITS[match[2].toLowerCase()]
    if (!unit) throw new Error(`Invalid byte size unit: ${match[2]}`)

    return amount * unit
  },
}
