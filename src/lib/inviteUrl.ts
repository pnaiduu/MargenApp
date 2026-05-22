/** Public site origin for invite links and QR (e.g. https://trymargen.com). Falls back to current origin in dev. */
export function publicSiteOrigin() {
  const fromEnv = import.meta.env.VITE_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function joinPath(token: string) {
  return `/join/${encodeURIComponent(token)}`
}

export function inviteJoinAbsoluteUrl(token: string) {
  const base = publicSiteOrigin()
  if (!base) return joinPath(token)
  return `${base}${joinPath(token)}`
}

/** Synthetic login email derived from invite token (no inbox; used only with Supabase Auth). */
export function inviteLoginEmail(token: string) {
  const domain = import.meta.env.VITE_INVITE_EMAIL_DOMAIN?.trim() || 'invite.trymargen.com'
  const safe = token.replace(/[^a-zA-Z0-9]/g, '')
  return `invite.${safe}@${domain}`
}
