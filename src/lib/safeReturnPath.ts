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
