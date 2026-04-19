/** Normalize to #RRGGBB for accent math. */
export function normalizeHex(input: string): string {
  const raw = input.trim().replace(/^#/, '')
  if (raw.length === 3) {
    const e = raw.split('').map((c) => c + c).join('')
    return `#${e}`.toUpperCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`
  }
  return '#111827'
}

/** WCAG-ish contrast: pick near-black or white text on accent buttons. */
export function foregroundOnAccent(hex: string): string {
  const h = normalizeHex(hex).slice(1)
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return L > 0.55 ? '#111827' : '#ffffff'
}
