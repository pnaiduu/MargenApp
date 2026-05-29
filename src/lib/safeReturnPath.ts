/**
 * Where to send the user after auth. Only allows same-origin relative paths (no `//` open redirects).
 */
export function safeReturnPath(state: unknown): string {
  const from = (state as { from?: string } | undefined)?.from
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) {
    return '/dashboard'
  }
  const noHash = from.split('#')[0] ?? from
  return noHash || '/dashboard'
}

/** After sign-in, pricing/checkout pages should land on the dashboard, not back on pricing. */
export function postLoginPath(state: unknown): string {
  const from = (state as { from?: string } | undefined)?.from
  if (typeof from === 'string') {
    const path = from.split('#')[0] ?? from
    if (path === '/pricing' || path.startsWith('/pricing?') || path.startsWith('/pricing/')) {
      return '/dashboard'
    }
    if (path === '/subscribe' || path.startsWith('/subscribe')) {
      return '/dashboard'
    }
  }
  return safeReturnPath(state)
}
