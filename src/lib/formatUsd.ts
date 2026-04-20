const dash = '\u2014'

/** Cents → USD string. Null, NaN, or zero → em dash (never `$0`). */
export function formatUsdFromCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents) || cents === 0) return dash
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

/** Dollar amounts for charts (daily totals). Zero → em dash (never `$0`). */
export function formatUsdFromDollarsChart(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return dash
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

/** Plain currency from a dollar amount (not cents). Zero → em dash. */
export function formatUsdFromDollarsPlain(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return dash
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
