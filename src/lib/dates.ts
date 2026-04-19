export function addHoursIso(iso: string, hours: number): string {
  const d = new Date(iso)
  d.setTime(d.getTime() + hours * 60 * 60 * 1000)
  return d.toISOString()
}

export function startOfUtcMonthIso(reference = new Date()): string {
  const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1, 0, 0, 0, 0))
  return d.toISOString()
}

export function endOfUtcMonthIso(reference = new Date()): string {
  const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 0, 23, 59, 59, 999))
  return d.toISOString()
}

/** Inclusive start for last N calendar days (UTC midnight boundary). */
export function lastNDaysStartIso(days: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - (days - 1))
  return d.toISOString()
}

export function utcDayKey(iso: string): string {
  const d = new Date(iso)
  return d.toISOString().slice(0, 10)
}

/** Local calendar month bounds as ISO strings. */
export function localMonthRangeIso(reference = new Date()) {
  const y = reference.getFullYear()
  const m = reference.getMonth()
  const start = new Date(y, m, 1, 0, 0, 0, 0)
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/** Local week bounds (Mon 00:00 → Sun 23:59:59.999) as ISO strings. */
export function localWeekRangeIso(reference = new Date()) {
  const d = new Date(reference)
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diffToMon = (day + 6) % 7
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMon, 0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}
