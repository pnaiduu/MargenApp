/** Normalize pasted invite token or full join URL to raw token string. */
export function parseInviteToken(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (trimmed.includes('://') || trimmed.startsWith('/join')) {
    try {
      const path = trimmed.includes('://') ? new URL(trimmed).pathname : trimmed
      const parts = path.split('/').filter(Boolean)
      const joinIdx = parts.findIndex((p) => p === 'join')
      if (joinIdx >= 0 && parts[joinIdx + 1]) {
        return decodeURIComponent(parts[joinIdx + 1]!)
      }
    } catch {
      // fall through
    }
  }

  const fromPath = trimmed.replace(/^.*\/join\//i, '').split(/[?#]/)[0]?.trim()
  return fromPath ? decodeURIComponent(fromPath) : trimmed
}
