/** Start and end of the calendar day in the user's local timezone, as ISO strings. */
export function localDayRangeIso(reference = new Date()) {
  const y = reference.getFullYear()
  const m = reference.getMonth()
  const d = reference.getDate()
  const start = new Date(y, m, d, 0, 0, 0, 0)
  const end = new Date(y, m, d, 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}
